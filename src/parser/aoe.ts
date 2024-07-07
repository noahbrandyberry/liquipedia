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
  parseGroupRounds,
  parseMaps,
  parseMatchPopup,
  parseParticipant,
  parsePlayoffColumn,
} from "./aoe/tournament";
import { imageUrl } from "../data/image";
import { AOEClient } from "../client/aoe";
import { getPath } from "../data/url";
import { AOEApi } from "../api/aoe";
import { parseTournamentWikiText } from "./aoe/tournament-wikitext";
import { getAttributes } from "../data/attributes";
import { MapDetail } from "../types/aoe/map";

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
        links: twitchStream
          ? [
              {
                text: "Twitch",
                url: `https://twitch.tv/${twitchStream
                  .toLowerCase()
                  .replace(/_/g, "")}`,
              },
            ]
          : [],
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
    title: string,
    path: string,
    client: AOEClient,
    api: AOEApi
  ): Promise<TournamentDetail> {
    const tournament: TournamentDetail = {
      schedule: [],
      type: TournamentType.Unknown,
      name: parse(title).textContent,
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
    const redirect = getPath(htmlRoot.querySelector(".redirectText a"));
    if (redirect) {
      return client.getTournament(redirect);
    }

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

    const attributes = getAttributes(htmlRoot);

    const series = attributes["Series"]?.[0];
    tournament.tier = attributes["Liquipedia Tier"]?.[0]?.path as
      | TournamentCategory
      | undefined;

    const image = imageUrl(htmlRoot.querySelector(".infobox-image img"), false);

    if (image) {
      tournament.league = {
        image,
        name: series?.text ?? "",
        path: series?.path,
      };
    }

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
    const prizePool = Number(
      attributes["Prize Pool"]?.[0].text?.replace(/[^0-9.]/g, "")
    );

    if (prizePool && !isNaN(prizePool)) {
      tournament.prizePool = {
        amount: prizePool,
        code: "USD",
      };
    }

    const start =
      attributes["Start Date"]?.[0].text ?? attributes["Date"]?.[0].text ?? "";
    const end = attributes["End Date"]?.[0].text ?? "";
    tournament.start = start
      ? dateParse(start, "y-MM-dd", new Date())
      : undefined;
    tournament.end = end ? dateParse(end, "y-MM-dd", new Date()) : undefined;
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
      htmlRoot
        .querySelector(
          "h3:has(#Schedule) + ul, h3:has(#Schedule) + .table-responsive + ul"
        )
        ?.toString() ?? ""
    );

    const multipleGroups = htmlRoot.querySelector(
      ".toggle-group, h3:has(#Group_Stage) + div, h3:has(#Round_Robin_Stage) + div"
    );

    if (
      htmlRoot.querySelector("h3:has(#Group_Stage) + h4 + h5:has(#Standings)")
    ) {
      let pointer = htmlRoot.querySelector("h3:has(#Group_Stage) + h4");

      while (pointer?.nextElementSibling.tagName.toLowerCase() === "h5") {
        const name = pointer.querySelector("span")?.textContent ?? "";
        pointer = pointer.nextElementSibling?.nextElementSibling;
        if (
          pointer.tagName.toLowerCase() === "div" &&
          pointer.classList.contains("table-responsive")
        ) {
          const div =
            pointer.nextElementSibling.nextElementSibling.querySelector(
              ":first-child"
            );
          tournament.groups.push({
            name,
            participants: pointer
              .querySelectorAll("tr:not(:first-child)")
              .map(parseGroupParticipant),
            rounds: div ? parseGroupRounds(div) : [],
          });
          pointer = div?.nextElementSibling ?? null;
        }
      }
    } else if (multipleGroups?.querySelector(".table-responsive")) {
      tournament.groups = parseAllGroups(multipleGroups);
    } else if (
      multipleGroups?.classList.contains("table-responsive") &&
      (multipleGroups.nextElementSibling.classList.contains("matchlist") ||
        multipleGroups.nextElementSibling.classList.contains("brkts-matchlist"))
    ) {
      tournament.groups.push({
        name:
          htmlRoot.querySelector(
            "#Swiss_Stage, #Group_Stage , #Round_Robin_Stage"
          )?.textContent ?? "Group Stage",
        participants:
          htmlRoot
            .querySelector(".swisstable, .grouptable")
            ?.querySelectorAll("tr:not(:first-child)")
            .map(parseGroupParticipant) ?? [],
        rounds: parseGroupRounds(multipleGroups.nextElementSibling),
      });
    } else if (multipleGroups) {
      tournament.groups.push({
        name:
          htmlRoot.querySelector(
            "#Swiss_Stage, #Group_Stage , #Round_Robin_Stage"
          )?.textContent ?? "Group Stage",
        participants:
          htmlRoot
            .querySelector(".swisstable, .grouptable")
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
    const participantsTable = htmlRoot.querySelector(
      ".participanttable, .participantTable"
    );

    tournament.maps = parseMaps(htmlRoot);
    if (participantsTable) {
      tournament.participants = parseAllParticipants(participantsTable);
    }

    tournament.resultsNote = NodeHtmlMarkdown.translate(
      htmlRoot.querySelector("h2:has(#Showmatch) + ul")?.toString() ?? ""
    );

    tournament.results = htmlRoot
      .querySelectorAll(".showmatch, .brkts-match-info-flat")
      .map<PlayoffMatch | null>((showmatch) => {
        if (
          showmatch.parentNode.getAttribute("style")?.includes("display: none;")
        ) {
          return null;
        }
        const participants = showmatch.querySelector(
          "tr:first-child, div:first-child"
        );
        const popup = showmatch.classList.contains("brkts-match-info-flat")
          ? showmatch
          : showmatch.querySelector(":has(.bracket-popup-body)") ?? showmatch;
        const [participant1, participant2]: EventParticipant[] =
          participants
            ?.querySelectorAll("th:first-child, th:last-child, .block-player")
            .map((participant) => ({
              name: participant.textContent.trim(),
              image: imageUrl(participant.querySelector("img")),
            })) ?? [];

        const [score1, score2] =
          participants
            ?.querySelectorAll(
              "th:nth-child(2), th:nth-child(3), .brkts-popup-header-opponent-score-left, .brkts-popup-header-opponent-score-right"
            )
            .map((scoreElement) => {
              const scoreText =
                scoreElement.classList.contains(
                  "brkts-popup-header-opponent-score-left"
                ) ||
                scoreElement.classList.contains(
                  "brkts-popup-header-opponent-score-right"
                )
                  ? scoreElement.textContent
                  : scoreElement.childNodes.find((node) => node.nodeType === 3)
                      ?.textContent;
              const score = isNaN(Number(scoreText))
                ? scoreText
                : Number(scoreText);
              return score;
            }) ?? [];

        if (!participant1 || !participant2) {
          return null;
        }
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
      participantsTable?.parentNode.nextElementSibling ??
      participantsTable?.nextElementSibling;

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
        format: event.querySelector(".Score abbr, .Round-solo abbr")
          ?.textContent,
        round: event.querySelector(".Round-solo")?.textContent.split(" (")[0],
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
      try {
        const wikiTextResponse = await api.getTournament(path, true);
        tournament.playoffs = parseTournamentWikiText(
          wikiTextResponse.parse.wikitext["*"]
        );
      } catch (error) {
        console.warn(error);
      }
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
    const attributes = getAttributes(htmlRoot);

    const player: Player = {
      name: header ?? "",
      image: imageUrl(htmlRoot.querySelector(".infobox-image img"), false),
      fullName: attributes["Name"]?.[0]?.text,
      nationality: getCountryByName(attributes["Nationality"]?.[0]?.text),
      status: attributes["Status"]?.[0]?.text,
      yearsActive: attributes["Years Active"]?.[0]?.text,
      team: attributes["Team"]?.[0]?.text,
    };

    if (attributes["Born"]?.[0]?.text) {
      const [birthdate, age] = attributes["Born"][0].text.split(" (");

      if (birthdate) {
        player.birthdate = dateParse(
          birthdate.replace(/ +/g, " "),
          "MMMM d, y",
          new Date()
        );
      }

      const parsedAge = Number(age.replace(/[^0-9]/g, ""));

      player.age = isNaN(parsedAge) ? undefined : parsedAge;
    }

    if (attributes["Approx. Total Winnings"]?.[0]?.text) {
      const amountNumber = Number(
        attributes["Approx. Total Winnings"][0].text
          .replace(/[^\d\.]+/, "")
          .replace(/,/g, "")
      );

      player.totalWinnings = isNaN(amountNumber)
        ? undefined
        : { amount: amountNumber, code: "USD" };
    }

    const overviewElement = htmlRoot.querySelector(".mw-parser-output > p");
    if (overviewElement) {
      player.overview = NodeHtmlMarkdown.translate(overviewElement.toString());
    }

    const bioElements = [];
    let bioElement = htmlRoot.querySelector(
      "h2:has(#Biography) + p, h2:has(#Overview) + p"
    );
    while (bioElement && ["P", "H3", "DIV"].includes(bioElement.tagName)) {
      if (bioElement.tagName === "H3") {
        bioElements.push(bioElement.querySelector(".mw-headline"));
      } else {
        bioElements.push(bioElement);
      }
      bioElement = bioElement.nextElementSibling;
    }

    if (bioElements.length > 0) {
      player.bio = NodeHtmlMarkdown.translate(bioElements.join(""));
    }

    return player;
  }

  parseMap(mapResponse: string): MapDetail {
    const htmlRoot = parse(mapResponse);

    const header = htmlRoot
      .querySelector(".infobox-header")
      ?.childNodes.find((node) => node.nodeType === 3)
      ?.textContent.trim();
    const attributes = getAttributes(htmlRoot);

    const map: MapDetail = {
      name: header ?? "",
      image: imageUrl(htmlRoot.querySelector(".infobox-image img"), false),
      creator: attributes["Creator"]?.[0]?.text,
      type: attributes["Map Type"]?.[0]?.text,
      walls: attributes["Walls"]?.[0]?.text,
      nomad: attributes["Nomad"]?.[0]?.text === "Yes",
    };

    const descriptionElement = htmlRoot.querySelector(".mw-parser-output > p");
    if (descriptionElement) {
      map.description = NodeHtmlMarkdown.translate(
        descriptionElement.toString()
      );
    }

    const overviewElements = [];
    let overviewElement = htmlRoot.querySelector("h2:has(#Overview) + p");
    while (
      overviewElement &&
      ["P", "H3", "DIV"].includes(overviewElement.tagName)
    ) {
      if (overviewElement.tagName === "H3") {
        overviewElements.push(overviewElement.querySelector(".mw-headline"));
      } else {
        overviewElements.push(overviewElement);
      }
      overviewElement = overviewElement.nextElementSibling;
    }

    if (overviewElements.length > 0) {
      map.overview = NodeHtmlMarkdown.translate(overviewElements.join(""));
    }

    return map;
  }
}
