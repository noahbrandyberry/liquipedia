import CeL, { type WikiData } from "cejs";
import { parseTemplate } from "../../data/template";
import { parse } from "../../common/parse";
import { parse as dateParse } from "date-fns";
import {
  EventParticipant,
  EventPlayer,
  PlayoffGame,
  PlayoffRound,
} from "../../types/aoe";

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
  CeL.run(["application.net.wiki"]);
  const parsedWikiText = removeEmpty(
    CeL.wiki.parse(
      parse(tournamentResponse.replace(/<!--(.*?)-->/g, "")).textContent
    )
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

  const bracket = data.find(
    (x): x is { title: string; content: WikiData } =>
      typeof x !== "string" && x.title === "Results"
  )?.content[0] as WikiData;

  const { templateName, id, ...bracketData } = parseTemplate(bracket);

  const rounds: PlayoffRound[] = Object.entries(bracketData).reduce<
    PlayoffRound[]
  >((acc, [roundKey, roundData]) => {
    if (!roundData) {
      return acc;
    }

    const isRound = roundKey.includes("header");
    if (isRound) {
      const roundId = roundKey.replace("header", "").replace(/M[0-9]+/, "");
      const roundName = roundData[0].toString().replace(" (", "");
      const bestOf = roundData[1].toString().replace("abbr/", "");
      acc.push({
        id: roundId,
        name: roundName,
        format: bestOf,
        matches: [],
      });
    } else {
      const roundId = roundKey.replace(/M[0-9]+/, "");
      const roundIndex = acc.findIndex((round) => round.id === roundId);
      const matchData = parseTemplate(roundData);

      if (roundIndex >= 0) {
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

        acc[roundIndex].matches.push({
          startTime: dateParse(
            `${matchData["date"]?.[0].toString().trim()} +00`,
            "MMMM dd, yyyy - kk:mm x",
            new Date()
          ),
          bestOf: matchData["bestof"]?.toString(),
          links: Object.entries(matchData)
            .filter(([key]) =>
              ["twitch", "youtube", "vod", "civdraft", "mapdraft"].includes(key)
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
    return acc;
  }, []);

  return [{ rounds }];
};
