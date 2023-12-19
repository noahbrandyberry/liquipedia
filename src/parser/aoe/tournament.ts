import { HTMLElement } from "node-html-parser";
import {
  EventParticipant,
  PlayoffGame,
  PlayoffMatch,
  PlayoffRound,
  TournamentDetail,
  Group,
  Round,
  GroupParticipant,
} from "../../types/aoe";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { getCountryByName } from "../../data/countries";
import { imageUrl } from "../../data/image";
import compact from "lodash/compact";

export const parsePlayoffColumn = (
  playoffColumn: HTMLElement
): PlayoffRound => {
  const playoffMatches = playoffColumn.querySelectorAll(".bracket-game");
  const name =
    playoffColumn
      .querySelector(".bracket-header")
      ?.childNodes.find((node) => node.nodeType === 3)
      ?.textContent?.replace("(", "")
      .trim() ?? "";

  const playoffRound: PlayoffRound = {
    name,
    format: playoffColumn.querySelector(".bracket-header abbr")?.textContent,
    matches: [],
  };

  for (const playoffMatch of playoffMatches) {
    const match = parsePlayoffMatch(playoffMatch);
    if (match) {
      playoffRound.matches.push(match);
    }
  }

  return playoffRound;
};

export const parsePlayoffMatch = (
  playoffMatch: HTMLElement
): PlayoffMatch | null => {
  const [participant1, participant2] = playoffMatch
    .querySelectorAll(
      ".bracket-player-top, .bracket-team-top, .bracket-player-bottom, .bracket-team-bottom"
    )
    .map(parseParticipant);

  if (!participant1 || !participant2) {
    return null;
  }

  const previous = playoffMatch.previousElementSibling;
  const name =
    previous.classList.contains("bracket-game") ||
    previous.querySelector(".bracket-header")
      ? undefined
      : previous.textContent;

  const match: PlayoffMatch = {
    name,
    participants: [participant1, participant2],
    winner:
      typeof participant1.score === "number" &&
      typeof participant2.score === "number"
        ? participant1.score > participant2.score
          ? 0
          : 1
        : undefined,
    ...parseMatchPopup(playoffMatch.querySelector(".bracket-popup-wrapper")),
  };

  return match;
};

export const parseMatchPopup = (popup: HTMLElement | null) => {
  const startTime = new Date(
    Number(
      popup
        ?.querySelector(".bracket-popup-body-time .timer-object")
        ?.getAttribute("data-timestamp")
    ) * 1000
  );
  const twitchStream = popup
    ?.querySelector(".bracket-popup-body-time .timer-object")
    ?.getAttribute("data-stream-twitch");

  const match: Omit<PlayoffMatch, "participants"> = {
    links: [],
    games: [],
    startTime: startTime && !isNaN(startTime.getTime()) ? startTime : undefined,
    twitchStream: twitchStream,
    note: NodeHtmlMarkdown.translate(
      popup?.querySelector(".bracket-popup-body-comment")?.toString() ?? ""
    ),
  };

  const matchLinks = popup?.querySelectorAll(".bracket-popup-footer a") ?? [];
  for (const matchLink of matchLinks) {
    match.links.push({
      url: matchLink.getAttribute("href") ?? "",
      text: matchLink.getAttribute("title") ?? "",
      image: `https://liquipedia.net${matchLink
        .querySelector("img")
        ?.getAttribute("src")}`,
    });
  }

  const matchGames = popup?.querySelectorAll(".bracket-popup-body-match") ?? [];
  for (const matchGame of matchGames) {
    match.games.push(parsePlayoffGame(matchGame));
  }

  return match;
};

export const parsePlayoffGame = (playoffGame: HTMLElement): PlayoffGame => {
  const teams = playoffGame.querySelectorAll(".leftTeam, .rightTeam");
  const [players1, players2] =
    teams.length > 0
      ? teams.map((team) =>
          team.querySelectorAll(":scope > span").map((player) => ({
            name: player.textContent.trim() || undefined,
            country: getCountryByName(
              player.querySelector(".flag img")?.getAttribute("alt")
            ),
            civilization: player
              .querySelector(".faction > a")
              ?.getAttribute("title"),
          }))
        )
      : playoffGame
          .querySelectorAll(".draft > a")
          .map((civ) => [{ civilization: civ.getAttribute("title") }]);

  const won =
    teams.length > 0
      ? teams.findIndex((team) => team.classList.contains("bg-win"))
      : playoffGame
          .querySelectorAll(".fa-check")
          .findIndex((team) => team.classList.contains("forest-green-text"));

  return {
    players: [
      players1?.filter((p) => compact(Object.values(p)).length),
      players2?.filter((p) => compact(Object.values(p)).length),
    ],
    map:
      playoffGame.querySelector(":scope > div > a, .lengthTeam")?.textContent ??
      "",
    winner: (won >= 0 ? won : undefined) as 0 | 1 | undefined,
  };
};

export const parseParticipant = (player: HTMLElement): EventParticipant => {
  const name =
    player?.querySelector(
      "span:not(.flag):not(.team-template-image-icon):not(.team-template-team-icon)"
    )?.textContent ?? "";
  const scoreText = player?.querySelector(".bracket-score")?.textContent;
  const score = isNaN(Number(scoreText)) ? scoreText : Number(scoreText);
  const image = imageUrl(
    player?.querySelector(".team-template-image-icon img, .flag > img")
  );

  return { name, score, image };
};

export const parseMaps = (htmlRoot: HTMLElement): TournamentDetail["maps"] => {
  const mapNames = htmlRoot.querySelectorAll(".mapstable th");
  const mapImages = htmlRoot.querySelectorAll(".mapstable td img");
  const categoriesTable = htmlRoot
    .querySelectorAll(".wikitable th")
    .find((element) => element.textContent.includes("Map categories"))
    ?.parentNode?.parentNode;
  const categoryRows = categoriesTable?.querySelectorAll("tr") ?? [];
  categoryRows.shift();
  const headers = categoryRows
    .shift()
    ?.querySelectorAll("th")
    .map((element) => element.textContent.trim());
  const categories = headers?.map(
    (categoryName, index) =>
      [
        categoryName,
        categoryRows.map((row) =>
          row.querySelectorAll("td")[index].textContent.trim()
        ),
      ] as const
  );

  return mapNames.map((mapName, index) => {
    const mapImage = mapImages[index];
    const name = mapName.textContent.trim();
    const category = categories?.find(([categoryName, maps]) =>
      maps.includes(name)
    );

    return {
      name,
      image: imageUrl(mapImage),
      path: mapName.querySelector("a")?.getAttribute("href"),
      category: category?.[0],
    };
  });
};

export const parseAllParticipants = (
  participantsTable: HTMLElement
): EventParticipant[] => {
  return participantsTable
    .querySelectorAll(".player-row td")
    .map((participant) => {
      return {
        name: participant.textContent.trim(),
        image: imageUrl(participant.querySelector(".flag img")),
      };
    })
    .filter((participant) => participant.name);
};

export const parseAllGroups = (groupsElement: HTMLElement | null): Group[] => {
  return (
    groupsElement?.querySelectorAll(".table-responsive").map((groupElement) => {
      const name =
        groupElement.querySelector("tr th > span")?.textContent ?? "";
      const hasRounds =
        groupElement.nextElementSibling.classList.contains("matchlist");
      const rounds = hasRounds
        ? parseGroupRounds(groupElement.nextElementSibling)
        : [];

      return {
        name,
        participants: groupElement
          .querySelectorAll("tr:not(:first-child)")
          .map(parseGroupParticipant),
        rounds,
      };
    }) ?? []
  );
};

export const parseGroupParticipant = (participant: HTMLElement) => {
  const nameCell = participant.querySelector(".grouptableslot");
  const matchScore = { win: 0, loss: 0, draw: 0 };
  const gameScore = { win: 0, loss: 0, draw: 0 };
  const matchesCell = participant
    .querySelector("td:nth-child(3)")
    ?.textContent.split("-");
  const gamesCell = participant
    .querySelector("td:nth-child(4)")
    ?.textContent.split("-");
  const pointsCell = participant.querySelector("td:nth-child(5)")?.textContent;

  matchesCell?.forEach((value, index) => {
    if (index == 0) {
      matchScore["win"] = Number(value);
    }
    if (index == 1) {
      matchScore["loss"] = Number(value);
    }
    if (index == 2) {
      matchScore["draw"] = Number(value);
    }
  });

  gamesCell?.forEach((value, index) => {
    if (index == 0) {
      gameScore["win"] = Number(value);
    }
    if (index == 1) {
      gameScore["loss"] = Number(value);
    }
    if (index == 2) {
      gameScore["draw"] = Number(value);
    }
  });

  const groupParticipant: GroupParticipant = {
    position: Number(participant.querySelector("th")?.textContent ?? 0),
    matchScore,
    gameScore,
    points: pointsCell,
    name: nameCell?.textContent.trim() ?? "",
    image: imageUrl(nameCell?.querySelector("img")),
    status: participant
      .querySelector("th")
      ?.classNames.replace("bg-", "") as GroupParticipant["status"],
  };

  return groupParticipant;
};

const parseGroupRounds = (roundsTable: HTMLElement): Round[] => {
  const rounds: Round[] = [];

  roundsTable?.querySelectorAll("tr").forEach((groupElement) => {
    if (groupElement.querySelector(".group-table-countdown")) {
      rounds.push({ name: groupElement.textContent, matches: [] });
    }

    if (groupElement.classList.contains("match-row")) {
      rounds.at(-1)?.matches.push(parseGroupMatch(groupElement));
    }
  });

  return rounds;
};

export const parseGroupMatch = (groupElement: HTMLElement): PlayoffMatch => {
  const [participant1, participant2]: EventParticipant[] = groupElement
    .querySelectorAll(".matchlistslot")
    .map((participant) => ({
      name: participant.textContent.trim(),
      image: imageUrl(participant.querySelector("img")),
    }));

  const [score1, score2] = groupElement
    .querySelectorAll("td:not(.matchlistslot)")
    .map((scoreElement) => {
      const scoreText = scoreElement.childNodes.find(
        (node) => node.nodeType === 3
      )?.textContent;
      const score = isNaN(Number(scoreText)) ? scoreText : Number(scoreText);
      return score;
    });

  participant1.score = score1;
  participant2.score = score2;

  return {
    participants: [participant1, participant2],
    winner:
      typeof score1 === "number" && typeof score2 === "number"
        ? score1 > score2
          ? 0
          : 1
        : undefined,
    ...parseMatchPopup(groupElement.querySelector(".bracket-popup-wrapper")),
  };
};
