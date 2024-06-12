import { Age2TournamentCategory, Liquipedia } from "../src";

const fs = require("node:fs/promises");

const liquipedia = new Liquipedia({
  USER_AGENT: "MyAwesomeProject/1.0 (my.email@gmail.com)",
});

// test("parses tournaments correctly", async () => {
//   const tournaments = await liquipedia.aoe.getTournaments(
//     Age2TournamentCategory.TierS
//   );

//   await fs.writeFile(
//     "./data/tournaments.json",
//     JSON.stringify(tournaments, null, 2)
//   );
// });

// test("parses series of tournaments correctly", async () => {
//   const tournaments = await liquipedia.aoe.getTournaments("Warlords" as any);

//   await fs.writeFile(
//     "./data/series.json",
//     JSON.stringify(tournaments, null, 2)
//   );
// });

// test("parses player correctly", async () => {
//   const tournaments = await liquipedia.aoe.getPlayer("MbL");

//   await fs.writeFile(
//     "./data/player.json",
//     JSON.stringify(tournaments, null, 2)
//   );
// });

test("parses tournament correctly", async () => {
  const tournament = await liquipedia.aoe.getTournament(
    "Red_Bull_Wololo/El_Reinado/AoE2"
  );

  await fs.writeFile(
    "./data/tournament.json",
    JSON.stringify(tournament, null, 2)
  );
});

// test("parses map correctly", async () => {
//   const map = await liquipedia.aoe.getMap("Baltic");

//   await fs.writeFile("./data/map.json", JSON.stringify(map, null, 2));
// });

// test("parses live matches correctly", async () => {
//   const liveMatches = await liquipedia.aoe.getMatches();

//   await fs.writeFile("./data/live.json", JSON.stringify(liveMatches, null, 2));
// });

// test("parses team tournament correctly", async () => {
//   const tournament = await liquipedia.aoe.getTournament("Nations_Cup/2023");

//   await fs.writeFile(
//     "./data/team-tournament.json",
//     JSON.stringify(tournament, null, 2)
//   );
// });

// test("parses qualifier correctly", async () => {
//   const tournament = await liquipedia.aoe.getTournament(
//     "Warlords/2/Qualifier/1"
//   );

//   await fs.writeFile(
//     "./data/qualifier.json",
//     JSON.stringify(tournament, null, 2)
//   );
// });
