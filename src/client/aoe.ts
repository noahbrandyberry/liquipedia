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
  TournamentCategory,
  Age2TournamentCategory,
  TournamentDetail,
  TournamentSection,
  Tournament,
  GameVersion,
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
    tournamentType: TournamentCategory
  ): Promise<TournamentSection[]> {
    const response = await this.api.getTournaments(tournamentType);
    return this.parser.parseTournaments(response.parse.text["*"]);
  }

  async getUpcomingTournaments(game: GameVersion): Promise<Tournament[]> {
    const response = await this.api.getTournaments(
      "Portal:Tournaments" as TournamentCategory
    );
    return this.parser
      .parseTournaments(response.parse.text["*"])
      .filter((section) => section.title !== "Three Most Recent")
      .flatMap((section) => section.data)
      .filter((tournament) => tournament.game === game);
  }

  async getAllTournaments(): Promise<Tournament[]> {
    const response = await this.api.getTournaments(
      "Age_of_Empires_II/Tournaments/Pre_2020" as TournamentCategory
    );
    return await this.parser.parseAllTournaments(
      response.parse.text["*"],
      this
    );
  }

  async getTournament(path: string): Promise<TournamentDetail> {
    const response = await this.api.getTournament(path);
    return await this.parser.parseTournament(
      response.parse.text["*"],
      path,
      this.api
    );
  }
}
