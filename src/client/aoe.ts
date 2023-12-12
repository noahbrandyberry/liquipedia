import { Config } from "../types/config";
import { Hero } from "../types/aoe/hero";
import { Match } from "../types/aoe/match";
import { Patch } from "../types/aoe/patch";
import { Player } from "../types/aoe/player";
import { Team } from "../types/aoe/team";
import { Transfer } from "../types/aoe/transfer";
import { AOEApi } from "../api/aoe";
import { AOEParser } from "../parser/aoe";
import {
  Tournament,
  TournamentStatus,
  TournamentCategory,
  Age2TournamentCategory,
} from "../types/aoe/tournaments";
import { Item } from "../types/aoe/item";

export class AOEClient {
  private api: AOEApi;

  private parser: AOEParser;

  constructor(config: Config) {
    this.api = new AOEApi(config);
    this.parser = new AOEParser();
  }

  async getPlayers(): Promise<Player[]> {
    const response = await this.api.getPlayers();
    return this.parser.parsePlayers(response.parse.text["*"]);
  }

  async getPlayer(name: string): Promise<Player> {
    const response = await this.api.getPlayer(name);
    return this.parser.parsePlayer(response.parse.text["*"]);
  }

  async getTeams(): Promise<Team[]> {
    const response = await this.api.getTeams();
    return this.parser.parseTeams(response.parse.text["*"]);
  }

  async getTransfers(): Promise<Transfer[]> {
    const response = await this.api.getTransfers();
    return this.parser.parseTransfers(response.parse.text["*"]);
  }

  async getMatches(): Promise<Match[]> {
    const response = await this.api.getMatches();
    return this.parser.parseMatches(response.parse.text["*"]);
  }

  async getHeroes(): Promise<Hero[]> {
    const response = await this.api.getHeroes();
    return this.parser.parseHeroes(response.parse.text["*"]);
  }

  async getItems(): Promise<Item[]> {
    const response = await this.api.getItems();
    return this.parser.parseItems(response.parse.text["*"]);
  }

  async getPatches(): Promise<Patch[]> {
    const response = await this.api.getPatches();
    return this.parser.parsePatches(response.parse.text["*"]);
  }

  async getTournaments(
    tournamentType: TournamentCategory = Age2TournamentCategory.TierS
  ): Promise<Tournament[]> {
    const response = await this.api.getTournaments(tournamentType);
    return this.parser.parseTournaments(response.parse.text["*"]);
  }
}
