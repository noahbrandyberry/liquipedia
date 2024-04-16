import { parseTemplate } from "../../data/template";
import { parse } from "../../common/parse";
import { parse as dateParse } from "date-fns";
import {
  EventParticipant,
  EventPlayer,
  Playoff,
  PlayoffGame,
  PlayoffRound,
} from "../../types/aoe";
import { type WikiData, wiki } from "../../wikitext/CeJS_wiki";
import { compact, sortBy } from "lodash";

function removeEmpty(data: WikiData): WikiData {
  return data.reduce<WikiData>((acc, row) => {
    if (typeof row === "string") {
      if (!!row.trim() && !["'''", ", ", ","].includes(row)) {
        acc.push(row);
      }
    } else {
      const newData = removeEmpty(row);
      if (newData) {
        acc.push(newData);
      }
    }

    return acc;
  }, []);
}

export const parseTournamentWikiText = (tournamentResponse: string) => {
  // CeL.run(["application.net.wiki"]);
  const parsedWikiText = removeEmpty(
    wiki.parse(
      parse(tournamentResponse.replace(/<!--(.*?)-->/g, "")).textContent
    ) as WikiData
  );

  const data = parsedWikiText.reduce<
    Array<string | { title: string; content: WikiData }>
  >(
    (parsed, row) => {
      const lastIndex = parsed.length - 1;
      let last = parsed[lastIndex];
      if (typeof row === "string") {
        if (typeof last === "string") {
          last += row;
        } else {
          parsed.push(row);
        }
      } else {
        if (row.length === 1 && typeof row[0] === "string") {
          parsed.push({ title: row[0], content: [] });
        } else if (typeof last !== "string") {
          last.content.push(row);
        }
      }

      parsed[lastIndex] = last;

      return parsed;
    },
    [{ title: "Header", content: [] }]
  );

  // return data as unknown as TournamentDetail;

  let results =
    data.find(
      (x): x is { title: string; content: WikiData } =>
        typeof x !== "string" && x.title === "Playoffs"
    )?.content ?? [];

  if (results.length === 0) {
    results =
      data.find(
        (x): x is { title: string; content: WikiData } =>
          typeof x !== "string" && x.title === "Results"
      )?.content ?? [];
  }

  if (results.length === 0) {
    results =
      data.find(
        (x): x is { title: string; content: WikiData } =>
          typeof x !== "string" &&
          x.content.some(
            (row) =>
              Array.isArray(row) &&
              row[0][0] === "Stage" &&
              row[0][1][0] === "Results"
          )
      )?.content ?? [];

    const resultsHeaderIndex = results.findIndex(
      (row) =>
        Array.isArray(row) &&
        row[0][0] === "Stage" &&
        row[0][1][0] === "Results"
    );
    const possibleResults = results.slice(resultsHeaderIndex + 1);
    results = possibleResults;
  }

  const brackets: Playoff[] = [];

  results.forEach((r, index) => {
    if (
      r[0]?.[1]?.[0] === "Playoffs" ||
      r[1]?.[0] === "Playoffs" ||
      r[0]?.[0] === "Stage" ||
      r[0] === "Bracket" ||
      r[0] === "GroupToggle"
    ) {
      let name = Array.isArray(r[0]?.[1])
        ? r[0]?.[1]?.[0]?.toString()
        : undefined;
      let bracket =
        results[r[0] === "Bracket" ? index : index < 0 ? 0 : index + 1];
      let advances: EventParticipant[] | undefined;

      if (r[0] === "GroupToggle") {
        const parsedToggle = parseTemplate(r);
        if (
          typeof parsedToggle === "string" ||
          !parsedToggle ||
          !parsedToggle.bracket
        ) {
          return;
        }
        bracket = parsedToggle.bracket;
        name = parsedToggle.group?.toString();
        advances = compact(
          Object.entries(parsedToggle).map<EventParticipant | null>(
            ([key, value]) => {
              if (key.startsWith("win") && value) {
                return { name: value.toString() };
              }

              return null;
            }
          )
        );
      }

      const { templateName, id, ...bracketData } = parseTemplate(bracket);

      const roundIds: string[] = [];
      const extraHeaders: { [key: string]: { name: string; format?: string } } =
        {};
      const rounds: PlayoffRound[] = Object.entries(bracketData)
        .reduce<PlayoffRound[]>((acc, [roundKey, roundData]) => {
          if (!roundData) {
            return acc;
          }

          const isRound = roundKey.includes("header");
          if (isRound) {
            const roundId = roundKey
              .replace("header", "")
              .replace(/M[0-9]+/, "");
            const roundName = roundData[0].toString().replace(" (", "");
            const bestOf = roundData[1].toString().replace("abbr/", "");

            if (roundIds.includes(roundId) || roundId === "RxMTP") {
              extraHeaders[roundKey.replace("header", "")] = {
                name: roundName,
                format: bestOf,
              };
            } else {
              const roundNumber = roundId.replace(/[^0-9]/g, "");
              const lastRoundNumber = roundIds[roundIds.length - 1]?.replace(
                /[^0-9]/g,
                ""
              );

              if (
                roundNumber &&
                lastRoundNumber &&
                Number(roundNumber) < Number(lastRoundNumber)
              ) {
                acc.push({
                  id: roundId,
                  name: "",
                  format: "",
                  matches: [],
                });

                extraHeaders[roundKey.replace("header", "")] = {
                  name: roundName,
                  format: bestOf,
                };
              } else {
                roundIds.push(roundId);

                acc.push({
                  id: roundId,
                  name: roundName,
                  format: bestOf,
                  matches: [],
                });
              }
            }
          } else {
            const roundId = roundKey.replace(/M[0-9]+/, "");
            let roundIndex = acc.findIndex((round) => round.id === roundId);
            if (roundIndex < 0) {
              roundIndex = acc.length - 1;
            }
            const matchData = parseTemplate(roundData);

            if (acc[roundIndex]) {
              const [participant1, participant2] = Object.entries(matchData)
                .filter(([key]) => key.startsWith("opponent"))
                .map<EventParticipant>(([_, opponent]) => ({
                  name: parseTemplate(opponent)["value"]?.toString() ?? "",
                }));

              const games = Object.entries(matchData)
                .filter(([key]) => key.match(/map[0-9]+/))
                .map<PlayoffGame>(([_, game]) => {
                  const gameData = parseTemplate(game);
                  const winner =
                    gameData["winner"] === "1"
                      ? 0
                      : gameData["winner"] === "2"
                      ? 1
                      : undefined;

                  const [participant1, participant2] = Object.entries(gameData)
                    .filter(([key]) => key.startsWith("civs"))
                    .map(([key, civsString]) => {
                      const teamNumber = key.replace(/[^0-9]/g, "");
                      const civs = civsString?.toString().split(",");
                      const names = gameData[`players${teamNumber}`]
                        ?.toString()
                        .split(",");
                      return civs?.map<EventPlayer>((civilization, index) => ({
                        civilization,
                        name: names?.[index],
                      }));
                    });

                  return {
                    winner,
                    map: gameData["map"]?.toString() ?? "",
                    players: participant1 &&
                      participant2 && [participant1, participant2],
                  };
                });

              const date = dateParse(
                `${matchData["date"]?.[0].toString().trim()} +00`,
                "MMMM dd, yyyy - kk:mm x",
                new Date()
              );

              acc[roundIndex].matches.push({
                header:
                  extraHeaders[roundKey] ??
                  (roundId === "RxMTP"
                    ? { name: "Third Place Match" }
                    : undefined),
                startTime: isNaN(date.valueOf()) ? undefined : date,
                bestOf: matchData["bestof"]?.toString(),
                links: Object.entries(matchData)
                  .filter(([key]) =>
                    [
                      "twitch",
                      "youtube",
                      "vod",
                      "civdraft",
                      "mapdraft",
                    ].includes(key)
                  )
                  .map(([key, value]) => ({
                    text: key,
                    url: value?.toString() ?? "",
                  })),
                participants: [participant1, participant2],
                games,
              });
            }
          }

          acc = sortBy(acc, "id");
          return acc;
        }, [])
        .filter((round) => round.matches.length);

      if (rounds.length > 0) {
        brackets.push({
          advances,
          rounds,
          name,
        });
      }
    }
  });

  return brackets;
};
