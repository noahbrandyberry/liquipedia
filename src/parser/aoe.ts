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
  TournamentCategory,
  TournamentType,
  TournamentLocationType,
  TournamentDetail,
  Age2TournamentCategory,
  EventParticipant,
  TournamentSection,
  Playoff,
  GameVersion,
  PlayoffMatch,
  BroadcastTab,
} from "../types/aoe/tournaments";
import { parse } from "../common/parse";
import { parse as dateParse } from "date-fns";
import { Match } from "../types/aoe/match";
import { Player } from "../types/aoe/player";
import { getCountryByName } from "../data/countries";
import { NodeHtmlMarkdown } from "node-html-markdown";
import {
  parseAllGroups,
  parseAllParticipants,
  parseGroupMatch,
  parseGroupParticipant,
  parseMaps,
  parseMatchPopup,
  parseParticipant,
  parsePlayoffColumn,
} from "./aoe/tournament";
import { imageUrl } from "../data/image";
import { AOEClient } from "../client/aoe";
import { getPath } from "../data/url";
import { HTMLElement } from "node-html-parser";
import { AOEApi } from "../api/aoe";
import { parseTournamentWikiText } from "./aoe/tournament-wikitext";

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
      const [participant1, participant2] = matchDetails
        .querySelectorAll(".team-left, .team-right")
        .map(parseParticipant);

      const bestOf = matchDetails.querySelector(".versus abbr")?.textContent;

      const matchTimeContainer = matchDetails.querySelector(".timer-object");
      const matchTime = matchTimeContainer?.getAttribute("data-timestamp");
      const twitchStream =
        matchTimeContainer?.getAttribute("data-stream-twitch");

      const tournament = matchDetails.querySelector(
        ".league-icon-small-image > a"
      );

      if (
        !participant1 ||
        !participant2 ||
        !bestOf ||
        !matchTime ||
        participant1.name.trim().toLowerCase() === "tbd" ||
        participant2.name.trim().toLowerCase() === "tbd"
      ) {
        continue;
      }

      const startTimestamp = Number(matchTime) * 1000;

      const score = matchDetails.querySelector(".versus > div")?.textContent;
      const [scoreLeft, scoreRight] = score?.split(":") ?? [];

      participant1.score = isNaN(Number(scoreLeft))
        ? undefined
        : Number(scoreLeft);
      participant2.score = isNaN(Number(scoreRight))
        ? undefined
        : Number(scoreRight);

      const match: Match = {
        participants: [participant1, participant2],
        format: bestOf,
        startTime: new Date(startTimestamp),
        twitchStream: twitchStream
          ? `https://twitch.tv/${twitchStream.toLowerCase().replace(/_/g, "")}`
          : undefined,
        tournament: {
          name: tournament?.getAttribute("title") ?? "",
          path: getPath(tournament) ?? "",
          image: imageUrl(tournament?.querySelector("img")),
        },
      };

      matches.push(match);
    }
    return matches;
  }

  async parseAllTournaments(
    tournamentsResponse: string,
    client: AOEClient
  ): Promise<Tournament[]> {
    const tournamentSections: TournamentSection[] =
      this.parseTournaments(tournamentsResponse);

    const htmlRoot = parse(tournamentsResponse);

    const tabs = htmlRoot.querySelectorAll(".tabs4 a:not(.selflink)");

    const responses = await Promise.all(
      tabs
        .reverse()
        .map((tab) =>
          client.getTournaments(tab.getAttribute("title") as TournamentCategory)
        )
    );
    const allTournaments = [...responses.flat(), ...tournamentSections].flatMap(
      (section) => section.data
    );

    return allTournaments;
  }

  parseTournaments(
    tournamentsResponse: string,
    category?: TournamentCategory
  ): TournamentSection[] {
    const tournamentSections: TournamentSection[] = [];

    const htmlRoot = parse(tournamentsResponse);

    const tournamentSectionBoxes = htmlRoot.querySelectorAll(".tournamentCard");

    for (const tournamentSection of tournamentSectionBoxes) {
      const data: Tournament[] = [];
      const sectionTitle =
        tournamentSection.previousElementSibling.querySelector(".mw-headline")
          ?.textContent ?? "";

      const tournamentDetailBoxes =
        tournamentSection.querySelectorAll(".gridRow");

      for (const tournamentDetails of tournamentDetailBoxes) {
        const tier =
          (getPath(
            tournamentDetails.querySelector(".Tier > span:not(.GameIcon) a")
          ) as TournamentCategory | undefined) || category;
        const leagueImage = tournamentDetails.querySelector(
          ".Tournament .league-icon-small-image img"
        );
        const game = (tournamentDetails
          .querySelector(".Game a")
          ?.getAttribute("title") ?? "") as GameVersion;
        const league: Tournament["league"] = leagueImage
          ? {
              name: leagueImage.getAttribute("alt") ?? "",
              image: imageUrl(leagueImage),
            }
          : undefined;
        const tourLink = tournamentDetails.querySelector(".Tournament > a");
        const name = tourLink?.textContent;

        const path = getPath(tourLink) ?? "";

        const dates = tournamentDetails.querySelector(".Date")?.textContent;
        const prizePool =
          tournamentDetails.querySelector(".Prize")?.textContent;
        const participantsCount = parseInt(
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
        const participants: Tournament["participants"] = tournamentDetails
          .querySelectorAll(".Placement")
          .map((element) => {
            const name = element.textContent.trim();
            const image = element.querySelector(".Participants img");

            return { name, image: imageUrl(image) };
          })
          .filter(
            (participant) => participant.name && participant.name !== "TBD"
          );

        const participantElement =
          tournamentDetails.querySelector(".Participants");

        if (participantElement && participants.length > 0) {
          if (participantElement.querySelector(".block-player")) {
            type = TournamentType.Individual;
          } else if (participantElement.querySelector(".block-team")) {
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

        if (
          !tier ||
          !tourLink ||
          !name ||
          !path ||
          !dates ||
          !participantsCount
        ) {
          continue;
        }

        const prizePoolNumber = Number(
          prizePool?.replace(/[^\d\.]+/, "").replace(/,/g, "")
        );

        const tournament: Tournament = {
          game,
          type,
          tier,
          name,
          start,
          end,
          prizePool: isNaN(prizePoolNumber)
            ? undefined
            : { amount: prizePoolNumber, code: "USD" },
          participants,
          participantsCount,
          location: locationName
            ? {
                name: locationName,
                country: getCountryByName(locationCountry),
                type:
                  locationCountry === "World"
                    ? TournamentLocationType.Online
                    : TournamentLocationType.LAN,
              }
            : undefined,
          league,
          path,
        };
        data.push(tournament);
      }

      tournamentSections.push({ title: sectionTitle, data });
    }
    return tournamentSections;
  }

  async parseTournament(
    tournamentResponse: string,
    path: string,
    api: AOEApi
  ): Promise<TournamentDetail> {
    const tournament: TournamentDetail = {
      game: GameVersion.Age1,
      schedule: [],
      type: TournamentType.Unknown,
      tier: Age2TournamentCategory.TierS,
      name: "",
      description: "",
      format: "",
      rules: "",
      path,
      participantsCount: 0,
      participants: [],
      playoffs: [],
      tabs: [],
      maps: [],
      groups: [],
      results: [],
      prizes: [],
    };

    const htmlRoot = parse(tournamentResponse);
    const attributes: Record<
      string,
      { path?: string; text: string; element: HTMLElement }[] | undefined
    > = {};

    const tabRows = htmlRoot.querySelectorAll(".tabs-static");
    for (const tabRow of tabRows) {
      const tabs = [];
      for (const tab of tabRow.querySelectorAll("a")) {
        tabs.push({
          path: getPath(tab) ?? path,
          name: tab.textContent,
          active: tab.parentNode.classList.contains("active"),
        });
      }
      tournament.tabs.push(tabs);
    }

    htmlRoot.querySelectorAll(".infobox-description").forEach((info) => {
      const anchors = info.nextElementSibling.querySelectorAll(":scope > a");
      const attributeValues =
        anchors.length > 0
          ? info.nextElementSibling
              .querySelectorAll(":scope > a")
              .map((anchor) => ({
                path: getPath(anchor),
                text: anchor.textContent,
                element: anchor,
              }))
          : [
              {
                text: info.nextElementSibling.textContent,
                element: info.nextElementSibling,
              },
            ];
      attributes[info.textContent.trim().replace(/.$/, "")] = attributeValues;
    });

    const series = attributes["Series"]?.[0];

    tournament.name =
      htmlRoot
        .querySelector(".infobox-header")
        ?.childNodes.find((node) => node.nodeType === 3)
        ?.textContent.trim() ?? "";

    tournament.league = {
      image: imageUrl(htmlRoot.querySelector(".infobox-image img")),
      name: series?.text ?? "",
      path: series?.path,
    };

    const location = attributes["Location"]?.[0];
    const locationName = location?.text.trim();
    const locationCountry = location?.element
      .querySelector(".flag a")
      ?.getAttribute("title");

    tournament.game = (attributes["Game & Version"]?.[0]?.text ??
      "") as GameVersion;
    tournament.location = locationName
      ? {
          name: locationName,
          country: getCountryByName(locationCountry),
          type:
            locationCountry === "World"
              ? TournamentLocationType.Online
              : TournamentLocationType.LAN,
        }
      : undefined;

    tournament.gameMode = attributes["Game Mode"]?.[0].text;
    tournament.venue = attributes["Venue"]?.[0].text;
    tournament.organizer = attributes["Organizer"]?.[0].text;
    tournament.version = attributes["Game & Version"]?.[1]?.text;

    tournament.prizePool = {
      amount: Number(
        attributes["Prize Pool"]?.[0].text?.replace(/[^0-9.]/g, "")
      ),
      code: "USD",
    };
    const start =
      attributes["Start Date"]?.[0].text ?? attributes["Date"]?.[0].text ?? "";
    const end = attributes["End Date"]?.[0].text ?? "";
    tournament.start = start ? new Date(start) : undefined;
    tournament.end = end ? new Date(end) : undefined;
    tournament.participantsCount = Number(
      attributes["Number of Players"]?.[0].text ||
        attributes["Number of Teams"]?.[0].text
    );

    if (attributes["Number of Players"]?.[0].text) {
      tournament.type = TournamentType.Individual;
    }
    if (attributes["Number of Teams"]?.[0].text) {
      tournament.type = TournamentType.Team;
    }

    tournament.description = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector(".mw-parser-output > p")?.toString() ?? ""
    );

    tournament.broadcastTalent = htmlRoot
      .querySelectorAll("h3:has(#Broadcast_Talent) + div .nav-tabs li")
      .map<BroadcastTab | null>((tab) => {
        const tabNumber = tab.classNames
          .split(" ")
          .find((c) => c.startsWith("tab"))
          ?.replace(/[^0-9]/g, "");

        if (!tabNumber) {
          return null;
        }
        const name = tab.text.trim();
        const content = NodeHtmlMarkdown.translate(
          htmlRoot
            .querySelector(
              `h3:has(#Broadcast_Talent) + div .tabs-content .content${tabNumber}`
            )
            ?.toString() ?? ""
        );

        return { name, content };
      })
      .filter((b): b is BroadcastTab => !!b);

    if (!tournament.broadcastTalent?.length) {
      tournament.broadcastTalent = [
        {
          name: "Broadcast",
          content: NodeHtmlMarkdown.translate(
            htmlRoot
              .querySelector("h3:has(#Broadcast_Talent) + div")
              ?.toString() ?? ""
          ),
        },
      ];
    }

    tournament.broadcastTalent = tournament.broadcastTalent.filter(
      (broadcast) => broadcast.content
    );

    tournament.format = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h3:has(#Format) + ul")?.toString() ?? ""
    );

    tournament.rules = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h3:has(#Rules_\\26_Settings) + ul")?.toString() ??
        ""
    );

    tournament.scheduleNote = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h3:has(#Schedule) + ul")?.toString() ?? ""
    );

    const multipleGroups = htmlRoot.querySelector(".toggle-group");
    if (multipleGroups?.querySelector(".table-responsive")) {
      tournament.groups = parseAllGroups(multipleGroups);
    } else if (multipleGroups) {
      tournament.groups.push({
        name:
          htmlRoot.querySelector("#Swiss_Stage, #Group_Stage")?.textContent ??
          "Group Stage",
        participants:
          htmlRoot
            .querySelector(".swisstable")
            ?.querySelectorAll("tr:not(:first-child)")
            .map(parseGroupParticipant) ?? [],
        rounds:
          multipleGroups?.querySelectorAll(".matchlist").map((round, index) => {
            return {
              id: `round-${index + 1}`,
              name:
                round.querySelector("tr:first-child")?.textContent.trim() ?? "",
              matches: round
                .querySelectorAll(".match-row")
                .map(parseGroupMatch),
            };
          }) ?? [],
      });
    }
    const participantsTable = htmlRoot.querySelector(".participanttable");

    tournament.maps = parseMaps(htmlRoot);
    if (participantsTable) {
      tournament.participants = parseAllParticipants(participantsTable);
    }

    tournament.results = htmlRoot
      .querySelectorAll(".showmatch")
      .map<PlayoffMatch | null>((showmatch) => {
        if (
          showmatch.parentNode.getAttribute("style")?.includes("display: none;")
        ) {
          return null;
        }
        const participants = showmatch.querySelector("tr:first-child");
        const popup = showmatch.querySelector("tr:last-child");
        const [participant1, participant2]: EventParticipant[] =
          participants
            ?.querySelectorAll("th:first-child, th:last-child")
            .map((participant) => ({
              name: participant.textContent.trim(),
              image: imageUrl(participant.querySelector("img")),
            })) ?? [];

        const [score1, score2] =
          participants
            ?.querySelectorAll("th:nth-child(2), th:nth-child(3)")
            .map((scoreElement) => {
              const scoreText = scoreElement.childNodes.find(
                (node) => node.nodeType === 3
              )?.textContent;
              const score = isNaN(Number(scoreText))
                ? scoreText
                : Number(scoreText);
              return score;
            }) ?? [];

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
          ...parseMatchPopup(popup),
        };
      })
      .filter((result): result is PlayoffMatch => !!result);

    tournament.prizes = htmlRoot
      .querySelectorAll(
        ".prizepool-section-tables .csstable-widget-row:not(.prizepooltable-header):not(.ppt-toggle-expand)"
      )
      .map((prize) => {
        const place =
          prize
            .querySelector(".csstable-widget-cell:first-child")
            ?.textContent.trim() ?? "";

        const prizePool = prize.querySelector(
          ".csstable-widget-cell:nth-child(2)"
        )?.textContent;
        const prizePoolNumber = Number(
          prizePool?.replace(/[^\d\.]+/, "").replace(/,/g, "")
        );

        const participants = prize
          .querySelectorAll(".block-team, .block-player")
          .map(parseParticipant);

        return {
          prize: isNaN(prizePoolNumber)
            ? undefined
            : { amount: prizePoolNumber, code: "USD" },
          place,
          participants,
        };
      });

    const participantNoteElement =
      participantsTable?.parentNode.nextElementSibling;

    if (participantNoteElement?.tagName.toLowerCase() === "p") {
      tournament.participantsNote = NodeHtmlMarkdown.translate(
        participantNoteElement.toString()
      );
    }

    const playoffRows = htmlRoot.querySelectorAll(".bracket-wrapper");

    for (const playoffRow of playoffRows) {
      const playoffColumns = playoffRow.querySelectorAll(
        ":scope > .bracket-scroller .bracket-column-matches"
      );
      const header = playoffRow.previousElementSibling;
      const name =
        header?.tagName.toLowerCase() === "p" || playoffRows.length > 0
          ? header?.querySelector("span:first-child")?.textContent.trim()
          : undefined;
      const row: Playoff = { name, rounds: [] };

      for (const playoffColumn of playoffColumns) {
        row.rounds.push(parsePlayoffColumn(playoffColumn));
      }

      tournament.playoffs.push(row);
    }

    tournament.playoffs = tournament.playoffs
      .map((playoffRow) => ({
        name: playoffRow.name,
        rounds: playoffRow.rounds.filter((playoff) => playoff.matches.length),
      }))
      .filter((playoffRow) => playoffRow.rounds.length);

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
        format: event.querySelector(".Score abbr")?.textContent,
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

    if (tournament.playoffs.length === 0) {
      const wikiTextResponse = await api.getTournament(path, true);
      tournament.playoffs = parseTournamentWikiText(
        wikiTextResponse.parse.wikitext["*"]
      );
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
