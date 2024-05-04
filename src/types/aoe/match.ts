import { EventParticipant, Link } from "./tournaments";

export type MatchTeam = {
  name: string;
  shortName?: string;
  currentScore?: number;
};

export enum MatchStatus {
  Upcoming = "Upcoming",
  Live = "Live",
  Completed = "Completed",
}

export type Match = {
  participants: [EventParticipant, EventParticipant];
  format?: string;
  winner?: 0 | 1;
  startTime?: Date;
  links: Link[];
  tournament: {
    name: string;
    image?: string;
    path: string;
  };
};

export interface MatchClient {
  getMatches(): Promise<Array<Match>>;
  getUpcomingMatches(): Promise<Array<Match>>;
  getLiveMatches(): Promise<Array<Match>>;
}
