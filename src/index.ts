import { AOEClient } from "./client/aoe";
import { Config } from "./types/config";

export class Liquipedia {
  aoe: AOEClient;

  constructor(private config: Config) {
    this.aoe = new AOEClient(config);
  }
}
