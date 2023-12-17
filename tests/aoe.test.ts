import { Liquipedia } from "../src";
const fs = require("node:fs/promises");

const liquipedia = new Liquipedia({
  USER_AGENT: "MyAwesomeProject/1.0 (my.email@gmail.com)",
});

test("parses tournaments correctly", async () => {
  const tournaments = await liquipedia.aoe.getTournaments();

  await fs.writeFile(
    "./data/tournaments.json",
    JSON.stringify(tournaments, null, 2)
  );
});

test("parses player correctly", async () => {
  const tournaments = await liquipedia.aoe.getPlayer("TheViper");

  await fs.writeFile(
    "./data/player.json",
    JSON.stringify(tournaments, null, 2)
  );
});

test("parses tournament correctly", async () => {
  const tournament = await liquipedia.aoe.getTournament(
    "AoE2_Admirals_League/2"
  );

  await fs.writeFile(
    "./data/tournament.json",
    JSON.stringify(tournament, null, 2)
  );
});

test("parses team tournament correctly", async () => {
  const tournament = await liquipedia.aoe.getTournament("Nations_Cup/2023");

  await fs.writeFile(
    "./data/team-tournament.json",
    JSON.stringify(tournament, null, 2)
  );
});

test("parses qualifier correctly", async () => {
  const tournament = await liquipedia.aoe.getTournament(
    "Warlords/2/Qualifier/1"
  );

  await fs.writeFile(
    "./data/qualifier.json",
    JSON.stringify(tournament, null, 2)
  );
});
