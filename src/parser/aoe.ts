import { Transfer } from "../types/aoe/transfer";
import { Team, TeamRegion } from "../types/aoe/team";
import { Patch } from "../types/aoe/patch";
import {
  BasicItemCategory,
  Item,
  ItemType,
  NeutralItemTier,
  UpgradeItemCategory,
} from "../types/aoe/item";
import { Hero, HeroAttr } from "../types/aoe/hero";
import {
  Tournament,
  TournamentStatus,
  TournamentCategory,
  TournamentType,
  TournamentLocationType,
  TournamentDetail,
  Age2TournamentCategory,
} from "../types/aoe/tournaments";
import { parse } from "../common/parse";
import { parse as dateParse } from "date-fns";
import { Match, MatchStatus } from "../types/aoe/match";
import { Player } from "../types/aoe/player";
import { countries } from "../data/countries";
import { Game } from "../types/games";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { parsePlayoffColumn } from "./aoe/tournament";
import { imageUrl } from "../data/image";

export class AOEParser {
  parseTeams(teamsResponse: string): Team[] {
    const htmlRoot = parse(teamsResponse);
    const parent = htmlRoot.querySelector(".lp-container-fluid"); // only active teams
    if (!parent) {
      return [];
    }
    const regionBoxes = parent.querySelectorAll(".panel-box");

    const teams: Team[] = [];
    for (const regionBox of regionBoxes) {
      const region = regionBox.querySelector(".panel-box-heading a")
        ?.textContent as TeamRegion;
      const teamDetailBoxes = regionBox.querySelectorAll(
        ".team-template-team-standard"
      );

      for (const teamDetail of teamDetailBoxes) {
        const teamLink = teamDetail.querySelector(".team-template-text a");
        const name = teamLink?.textContent;
        const url = teamLink?.getAttribute("href");
        const logo = teamDetail.querySelector("img")?.getAttribute("src");

        if (!name || !url) {
          continue;
        }

        const team: Team = {
          name,
          region,
          url: `https://liquipedia.net${url}`,
          logo: `https://liquipedia.net${logo}`,
        };
        teams.push(team);
      }
    }
    return teams;
  }

  parseHeroes(heroesResponse: string): Hero[] {
    const heroes: Hero[] = [];

    const htmlRoot = parse(heroesResponse);
    const heroesAttrBoxes = htmlRoot.querySelectorAll(".halfbox");

    const attrs = [HeroAttr.STR, HeroAttr.AGI, HeroAttr.INT];
    for (const [sectionIndex, heroesSection] of heroesAttrBoxes.entries()) {
      const attr = attrs[sectionIndex] || HeroAttr.STR;
      const heroDetailsSections = heroesSection.querySelectorAll("li");
      for (const heroDetails of heroDetailsSections) {
        const heroLink = heroDetails.querySelector("a");
        const img = heroLink?.querySelector("img")?.getAttribute("src") || "";
        const name = heroLink?.getAttribute("title") || "";
        const url = heroLink?.getAttribute("href");

        const hero: Hero = {
          name,
          attr,
          img: `https://liquipedia.net${img}`,
          url: `https://liquipedia.net${url}`,
        };
        heroes.push(hero);
      }
    }
    return heroes;
  }

  parseMatches(matchesResponse: string): Match[] {
    const htmlRoot = parse(matchesResponse);
    const matchDetailBoxes = htmlRoot.querySelectorAll(
      ".infobox_matches_content"
    );

    const matches: Match[] = [];
    for (const matchDetails of matchDetailBoxes) {
      const leftTeam = matchDetails.querySelector(".team-left > span");
      const leftTeamName = leftTeam?.getAttribute("data-highlightingclass");
      const leftTeamShortName = leftTeam?.querySelector(
        ".team-template-text a"
      )?.textContent;

      const rightTeam = matchDetails.querySelector(".team-right > span");
      const rightTeamName = rightTeam?.getAttribute("data-highlightingclass");
      const rightTeamShortName = rightTeam?.querySelector(
        ".team-template-text a"
      )?.textContent;

      const bestOf = matchDetails.querySelector(".versus abbr")?.textContent;

      const matchTimeContainer = matchDetails.querySelector(".timer-object");
      const matchTime = matchTimeContainer?.getAttribute("data-timestamp");
      const twitchStream =
        matchTimeContainer?.getAttribute("data-stream-twitch");

      const tournamentName = matchDetails
        .querySelector(".league-icon-small-image > a")
        ?.getAttribute("title");
      const tournamentShortName = matchDetails.querySelector(
        ".match-filler > div > div > a"
      )?.textContent;

      if (!leftTeamName || !rightTeamName || !bestOf || !matchTime) {
        continue;
      }

      // Convert to millisecond-based timestamp (multiply by 1000)
      const startTimestamp = parseInt(matchTime, 10) * 1000;
      const startTime = new Date(startTimestamp);

      const match: Match = {
        leftTeam: {
          name: leftTeamName,
          shortName: leftTeamShortName,
        },
        rightTeam: {
          name: rightTeamName,
          shortName: rightTeamShortName,
        },
        bestOf: parseInt(bestOf.slice(2), 10),
        status: MatchStatus.Upcoming,
        startTime,
        twitchStream: twitchStream
          ? `https://twitch.tv/${twitchStream.toLowerCase().replace(/_/g, "")}`
          : undefined,
        tournamentName,
        tournamentShortName,
      };

      if (startTimestamp < Date.now()) {
        match.status = MatchStatus.Live;

        // If we're live, parse the scores
        const score = matchDetails.querySelector(".versus > div")?.textContent;
        const scores = score?.split(":");
        if (scores) {
          match.leftTeam.currentScore = parseInt(scores[0], 10);
          match.rightTeam.currentScore = parseInt(scores[1], 10);
        }
      }

      matches.push(match);
    }
    return matches;
  }

  parseTournaments(tournamentsResponse: string): Tournament[] {
    const tournaments: Tournament[] = [];

    const htmlRoot = parse(tournamentsResponse);

    const tournamentSectionBoxes = htmlRoot.querySelectorAll(".tournamentCard");

    const tournamentStatuses = [
      TournamentStatus.Upcoming,
      TournamentStatus.Ongoing,
      TournamentStatus.Completed,
    ];
    for (const [
      sectionIndex,
      tournamentSection,
    ] of tournamentSectionBoxes.entries()) {
      const tournamentStatus =
        tournamentStatuses[sectionIndex] || TournamentStatus.Upcoming;

      const tournamentDetailBoxes =
        tournamentSection.querySelectorAll(".gridRow");

      for (const tournamentDetails of tournamentDetailBoxes) {
        const tier = tournamentDetails.querySelector(".Tier .selflink")
          ?.textContent as TournamentCategory | undefined;
        const leagueImage = tournamentDetails.querySelector(
          ".Tournament .league-icon-small-image img"
        );
        const league: Tournament["league"] = leagueImage
          ? {
              name: leagueImage.getAttribute("alt") ?? "",
              image: imageUrl(leagueImage),
            }
          : undefined;
        const tourLink = tournamentDetails.querySelector(".Tournament > a");
        const name = tourLink?.textContent;

        const url = tourLink?.getAttribute("href");
        const path = url?.split(`/${Game.AOE}/`).pop() ?? "";

        const dates = tournamentDetails.querySelector(".Date")?.textContent;
        const prizePool =
          tournamentDetails.querySelector(".Prize")?.textContent;
        const participants = parseInt(
          tournamentDetails.querySelector(".PlayerNumber")?.textContent || "0",
          0
        );
        const locationName = tournamentDetails
          .querySelector(".Location")
          ?.textContent?.trim();
        const locationCountry =
          tournamentDetails
            .querySelector(".Location img")
            ?.getAttribute("alt") ?? "";
        let type = TournamentType.Unknown;
        const individualWinner = tournamentDetails.querySelector(
          ".FirstPlace .Participants .block-player .name"
        )?.textContent;
        const teamWinner = tournamentDetails.querySelector(
          ".FirstPlace .Participants .block-team .name"
        )?.textContent;
        const individualRunnerUp = tournamentDetails.querySelector(
          ".SecondPlace .Participants .block-player .name"
        )?.textContent;
        const teamRunnerUp = tournamentDetails.querySelector(
          ".SecondPlace .Participants .block-team .name"
        )?.textContent;

        const winner = individualWinner || teamWinner;
        const runnerUp = individualRunnerUp || teamRunnerUp;
        if (winner !== "TBD") {
          if (individualWinner) {
            type = TournamentType.Individual;
          } else if (teamWinner) {
            type = TournamentType.Team;
          }
        }

        let start: Tournament["start"] = undefined;
        let end: Tournament["end"] = undefined;

        if (dates) {
          const [startPart, endPart] = dates.split(" - ");
          const [startMonth] = startPart.split(" ");
          const startYear = startPart.split(" ").pop();
          const startDay = startPart.match(/^\d+|\d+\b|\d+(?=\w)/g)?.[0];
          const differentYear = startYear?.length === 4;
          start = dateParse(
            `${startMonth} ${startDay} ${
              differentYear ? startYear : endPart.split(" ").pop()
            }`,
            "MMM d y",
            new Date()
          );

          if (endPart) {
            const [endMonth] = endPart.split(" ");
            const endYear = endPart.split(" ").pop();
            const endDay = endPart.match(/^\d+|\d+\b|\d+(?=\w)/g)?.[0];
            const differentMonth = /^[a-zA-Z]+$/.test(endMonth);

            end = dateParse(
              `${differentMonth ? endMonth : startMonth} ${endDay} ${endYear}`,
              "MMM d y",
              new Date()
            );
          }
        }

        if (!tier || !tourLink || !name || !url || !dates || !participants) {
          continue;
        }

        const prizePoolNumber = Number(
          prizePool?.replace(/[^\d\.]+/, "").replace(/,/g, "")
        );

        const tournament: Tournament = {
          type,
          status: winner ? TournamentStatus.Completed : tournamentStatus,
          tier,
          name,
          start,
          end,
          prizePool: isNaN(prizePoolNumber)
            ? undefined
            : { amount: prizePoolNumber, code: "USD" },
          participants,
          location: locationName
            ? {
                name: locationName,
                country: countries.find(
                  (country) => country.name === locationCountry
                ),
                type:
                  locationCountry === "World"
                    ? TournamentLocationType.Online
                    : TournamentLocationType.LAN,
              }
            : undefined,
          winner: winner === "TBD" ? undefined : winner,
          runnerUp: runnerUp === "TBD" ? undefined : runnerUp,
          league,
          path,
        };
        tournaments.push(tournament);
      }
    }
    return tournaments;
  }

  parseTournament(tournamentResponse: string, path: string): TournamentDetail {
    const tournament: TournamentDetail = {
      schedule: [],
      type: TournamentType.Unknown,
      tier: Age2TournamentCategory.TierS,
      status: TournamentStatus.Upcoming,
      name: "",
      description: "",
      format: "",
      rules: "",
      path,
      participants: 0,
      playoffs: [],
      tabs: [],
    };

    const htmlRoot = parse(tournamentResponse);
    const attributes: Record<string, string> = {};

    const tabRows = htmlRoot.querySelectorAll(".tabs-static");
    for (const tabRow of tabRows) {
      const tabs = [];
      for (const tab of tabRow.querySelectorAll("a")) {
        tabs.push({
          path: tab.getAttribute("title") ?? path,
          name: tab.textContent,
          active: tab.parentNode.classList.contains("active"),
        });
      }
      tournament.tabs.push(tabs);
    }

    htmlRoot
      .querySelectorAll(".infobox-description")
      .forEach(
        (info) =>
          (attributes[info.textContent.trim().replace(/.$/, "")] =
            info.nextSibling.textContent)
      );

    tournament.name =
      htmlRoot
        .querySelector(".infobox-header")
        ?.childNodes.find((node) => node.nodeType === 3)
        ?.textContent.trim() ?? "";

    tournament.league = {
      image: imageUrl(htmlRoot.querySelector(".infobox-image img")),
      name: "",
    };

    tournament.league.name = attributes["Series"];
    tournament.prizePool = {
      amount: Number(attributes["Prize Pool"]?.replace(/[^0-9.]/g, "")),
      code: "USD",
    };
    tournament.start = new Date(attributes["Start Date"]);
    tournament.end = new Date(attributes["End Date"]);
    tournament.participants = Number(
      attributes["Number of Players"] || attributes["Number of Teams"]
    );

    if (attributes["Number of Players"]) {
      tournament.type = TournamentType.Individual;
    }
    if (attributes["Number of Teams"]) {
      tournament.type = TournamentType.Team;
    }

    tournament.description = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector(".mw-parser-output > p")?.toString() ?? ""
    );

    tournament.format = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h3:has(#Format) + ul")?.toString() ?? ""
    );

    tournament.rules = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h3:has(#Rules_\\26_Settings) + ul")?.toString() ??
        ""
    );

    const playoffRows = htmlRoot.querySelectorAll(".bracket-wrapper");

    for (const playoffRow of playoffRows) {
      const playoffColumns = playoffRow.querySelectorAll(
        ".bracket-column-matches"
      );
      const row = [];

      for (const playoffColumn of playoffColumns) {
        row.push(parsePlayoffColumn(playoffColumn));
      }

      tournament.playoffs.push(row);
    }

    tournament.playoffs = tournament.playoffs
      .map((playoffRow) =>
        playoffRow.filter((playoff) => playoff.matches.length)
      )
      .filter((playoffRow) => playoffRow?.length);

    const schedule = htmlRoot.querySelectorAll(
      "h3:has(#Schedule) + .table-responsive .wikitable .Match"
    );

    for (const event of schedule) {
      const date = new Date(
        Number(
          event
            .querySelector(".Date .timer-object-datetime-only")
            ?.getAttribute("data-timestamp")
        ) * 1000
      );
      const playerLeft = event.querySelector(".TeamLeft");
      const playerRight = event.querySelector(".TeamRight");
      const [scoreLeft, scoreRight] =
        event.querySelector(".Score")?.textContent.split(":") ?? [];

      tournament.schedule?.push({
        date,
        participants: [
          {
            name: playerLeft?.textContent?.trim() ?? "",
            score: isNaN(Number(scoreLeft)) ? undefined : Number(scoreLeft),
            image: imageUrl(playerLeft?.querySelector("img")),
          },
          {
            name: playerRight?.textContent?.trim() ?? "",
            score: isNaN(Number(scoreRight)) ? undefined : Number(scoreRight),
            image: imageUrl(playerRight?.querySelector("img")),
          },
        ],
      });
    }

    return tournament;
  }

  parsePatches(patchesResponse: string): Patch[] {
    const patches: Patch[] = [];
    const htmlRoot = parse(patchesResponse);
    const parent = htmlRoot.querySelector(".wikitable");
    if (!parent) {
      return patches;
    }

    const patchDetailBoxes = parent.querySelectorAll("tr");
    for (const [i, patchDetails] of patchDetailBoxes.entries()) {
      if (i === 0) {
        // Skip table head
        continue;
      }

      const version =
        patchDetails.querySelector("td:nth-child(1) a")?.textContent || "";
      const url =
        patchDetails.querySelector("td:nth-child(1) a")?.getAttribute("href") ||
        "";
      const date =
        patchDetails.querySelector("td:nth-child(2)")?.textContent || "";
      const changes =
        patchDetails.querySelector("td:nth-child(3)")?.textContent || "";

      const patch: Patch = {
        version,
        date: new Date(date),
        changes: changes.replace(/^\n(\s)?/g, ""),
        url: `https://liquipedia.net${url}`,
      };
      patches.push(patch);
    }

    return patches;
  }

  parseTransfers(transfersResponse: string): Transfer[] {
    const htmlRoot = parse(transfersResponse);
    const transferDetailBoxes = htmlRoot.querySelectorAll(
      ".mainpage-transfer .divRow"
    );

    const transfers: Transfer[] = [];
    for (const transferDetails of transferDetailBoxes) {
      const date = transferDetails.querySelector(".Date")?.textContent;
      const players = transferDetails.querySelectorAll(".Name > a");
      const from = transferDetails.querySelector(".OldTeam");
      const fromTeam = from
        ?.querySelector(".team-template-team-icon")
        ?.getAttribute("data-highlightingclass");
      const fromPosition = from?.querySelector(
        'span[style="font-size:85%;font-style:italic"]'
      )?.textContent;
      const to = transferDetails.querySelector(".NewTeam");
      const toTeam = to
        ?.querySelector(".team-template-team-icon")
        ?.getAttribute("data-highlightingclass");
      const toPosition = to?.querySelector(
        'span[style="font-size:85%;font-style:italic"]'
      )?.textContent;

      const transfer: Transfer = {
        date: new Date(date || ""),
        players: players.map((playerElement) => playerElement.textContent),
        from: {
          team: fromTeam!,
          position: fromPosition,
        },
        to: {
          team: toTeam!,
          position: toPosition,
        },
      };
      transfers.push(transfer);
    }
    return transfers;
  }

  parseItems(itemsResponse: string): Item[] {
    const types = [
      {
        type: ItemType.Basic,
        categories: Object.values(BasicItemCategory),
      },
      {
        type: ItemType.RoshanDrop,
      },
      {
        type: ItemType.Upgrade,
        categories: Object.values(UpgradeItemCategory),
      },
      {
        type: ItemType.Neutral,
        categories: Object.values(NeutralItemTier),
      },
    ];

    const items: Item[] = [];

    const htmlRoot = parse(itemsResponse);
    const itemCategoryBoxes = htmlRoot.querySelectorAll(".row");

    let typeIndex = 0;
    let categoryIndex = 0;
    for (const itemCategory of itemCategoryBoxes) {
      const typeObj = types[typeIndex];
      if (!typeObj) {
        continue;
      }

      const { type } = typeObj;
      const category = typeObj.categories
        ? typeObj.categories[categoryIndex]
        : undefined;

      const itemBoxes = itemCategory.querySelectorAll(".responsive");
      for (const itemDetails of itemBoxes) {
        const url = itemDetails.querySelector("a")?.getAttribute("href") || "";
        const name =
          itemDetails.querySelector("a:nth-child(2)")?.getAttribute("title") ||
          "";
        const img = itemDetails.querySelector("img")?.getAttribute("src") || "";
        const price = itemDetails.querySelector("b")?.textContent || "";

        const item = {
          type,
          category,
          url: `https://liquipedia.net${url}`,
          name,
          img: `https://liquipedia.net${img}`,
          price: parseInt(price.replace(",", ""), 10) || undefined,
        };
        items.push(item as any);
      }
      if (
        !typeObj.categories ||
        typeObj.categories?.length <= categoryIndex + 1
      ) {
        typeIndex += 1;
        categoryIndex = 0;
      } else {
        categoryIndex += 1;
      }
    }

    return items;
  }

  parsePlayers(playersResponse: string): Player[] {
    const items: Player[] = [];

    return items;
  }

  parsePlayer(playerResponse: string): Player {
    const htmlRoot = parse(playerResponse);

    const header = htmlRoot
      .querySelector(".infobox-header")
      ?.childNodes.find((node) => node.nodeType === 3)
      ?.textContent.trim();
    const player: Player = { name: header ?? "" };

    return player;
  }
}
