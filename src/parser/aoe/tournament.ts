import { HTMLElement } from "node-html-parser";
import {
  EventParticipant,
  PlayoffGame,
  PlayoffMatch,
  PlayoffRound,
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

  const popup = playoffMatch.querySelector(".bracket-popup-wrapper");
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

  const previous = playoffMatch.previousElementSibling;
  const name =
    previous.classList.contains("bracket-game") ||
    previous.querySelector(".bracket-header")
      ? undefined
      : previous.textContent;

  const match: PlayoffMatch = {
    name,
    participants: [participant1, participant2],
    startTime: startTime && !isNaN(startTime.getTime()) ? startTime : undefined,
    twitchStream: twitchStream,
    note: NodeHtmlMarkdown.translate(
      playoffMatch.querySelector(".bracket-popup-body-comment")?.toString() ??
        ""
    ),
    links: [],
    games: [],
    winner:
      typeof participant1.score === "number" &&
      typeof participant2.score === "number"
        ? participant1.score > participant2.score
          ? 0
          : 1
        : undefined,
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

const parseParticipant = (player: HTMLElement): EventParticipant => {
  const name =
    player?.querySelector("span:not(.flag):not(.team-template-image-icon)")
      ?.textContent ?? "";
  const scoreText = player?.querySelector(".bracket-score")?.textContent;
  const score = isNaN(Number(scoreText)) ? scoreText : Number(scoreText);
  const image = imageUrl(
    player?.querySelector(".team-template-image-icon > img, .flag > img")
  );

  return { name, score, image };
};
