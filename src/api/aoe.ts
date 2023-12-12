import { Config } from "../types/config";
import {
  Age2TournamentCategory,
  TournamentCategory,
} from "../types/aoe/tournaments";
import { Request } from "../common/request";
import { Game } from "../types/games";

export class AOEApi {
  private request: Request;

  constructor(private config: Config) {
    this.request = new Request(Game.AOE, config.USER_AGENT, config.BASE_URL);
  }

  getPlayers() {
    return this.request.get("Players_(all)");
  }

  getPlayer(name: string) {
    return this.request.get(name);
  }

  getTeams() {
    return this.request.get("Portal:Teams");
  }

  // getTeam(name: string) {
  //   return this.request.get('');
  // }

  getTransfers() {
    return this.request.get("Portal:Transfers");
  }

  getMatches() {
    return this.request.get("Liquipedia:Upcoming_and_ongoing_matches");
  }

  getHeroes() {
    return this.request.get("Portal:Heroes");
  }

  getItems() {
    return this.request.get("Portal:Items");
  }

  getPatches() {
    return this.request.get("Portal:Patches");
  }

  getTournaments(
    tournamentTier: TournamentCategory = Age2TournamentCategory.All
  ) {
    return this.request.get(tournamentTier);
  }
}
