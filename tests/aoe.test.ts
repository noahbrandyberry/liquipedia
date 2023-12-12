import { Liquipedia } from "../src";
const fs = require("node:fs/promises");

test("parses tournaments correctly", async () => {
  const liquipedia = new Liquipedia({
    USER_AGENT: "MyAwesomeProject/1.0 (my.email@gmail.com)",
  });

  const tournaments = await liquipedia.aoe.getTournaments();

  await fs.writeFile(
    "./data/tournaments.json",
    JSON.stringify(tournaments, null, 2)
  );
});

test("parses player correctly", async () => {
  const liquipedia = new Liquipedia({
    USER_AGENT: "MyAwesomeProject/1.0 (my.email@gmail.com)",
  });

  const tournaments = await liquipedia.aoe.getPlayer("TheViper");

  await fs.writeFile(
    "./data/player.json",
    JSON.stringify(tournaments, null, 2)
  );
});
