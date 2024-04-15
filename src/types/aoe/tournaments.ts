import { Country } from "./country";

export type TournamentCategory =
  | Age1TournamentCategory
  | Age2TournamentCategory
  | Age3TournamentCategory
  | Age4TournamentCategory;

export enum Age1TournamentCategory {
  TierS = "Age_of_Empires_I/S-Tier_Tournaments",
  TierA = "Age_of_Empires_I/A-Tier_Tournaments",
  TierB = "Age_of_Empires_I/B-Tier_Tournaments",
  TierC = "Age_of_Empires_I/C-Tier_Tournaments",
  ShowMatches = "Age_of_Empires_I/Show_Matches",
  Qualifiers = "Age_of_Empires_I/Qualifier_Tournaments",
}

export enum Age2TournamentCategory {
  TierS = "Age_of_Empires_II/S-Tier_Tournaments",
  TierA = "Age_of_Empires_II/A-Tier_Tournaments",
  TierB = "Age_of_Empires_II/B-Tier_Tournaments",
  TierC = "Age_of_Empires_II/C-Tier_Tournaments",
  Weekly = "Age_of_Empires_II/Weekly_Tournaments",
  Monthly = "Age_of_Empires_II/Monthly_Tournaments",
  ShowMatches = "Age_of_Empires_II/Show_Matches",
  Qualifiers = "Age_of_Empires_II/Qualifier_Tournaments",
  Miscellaneous = "Age_of_Empires_II/Miscellaneous_Tournaments",
  FFA = "Age_of_Empires_II/FFA_Tournaments",
}

export enum Age3TournamentCategory {
  TierS = "Age_of_Empires_III/S-Tier_Tournaments",
  TierA = "Age_of_Empires_III/A-Tier_Tournaments",
  TierB = "Age_of_Empires_III/B-Tier_Tournaments",
  TierC = "Age_of_Empires_III/C-Tier_Tournaments",
  ShowMatches = "Age_of_Empires_III/Show_Matches",
  Qualifiers = "Age_of_Empires_III/Qualifier_Tournaments",
}

export enum Age4TournamentCategory {
  TierS = "Age_of_Empires_IV/S-Tier_Tournaments",
  TierA = "Age_of_Empires_IV/A-Tier_Tournaments",
  TierB = "Age_of_Empires_IV/B-Tier_Tournaments",
  TierC = "Age_of_Empires_IV/C-Tier_Tournaments",
  Weekly = "Age_of_Empires_IV/Weekly_Tournaments",
  Monthly = "Age_of_Empires_IV/Monthly_Tournaments",
  ShowMatches = "Age_of_Empires_IV/Show_Matches",
  Qualifiers = "Age_of_Empires_IV/Qualifier_Tournaments",
  Miscellaneous = "Age_of_Empires_IV/Miscellaneous_Tournaments",
  FFA = "Age_of_Empires_IV/FFA_Tournaments",
}

export enum AgeOnlineTournamentCategory {
  Tier = "Age_of_Empires_Online/Tier_Tournaments",
  ShowMatches = "Age_of_Empires_Online/Showmatches",
}

export enum TournamentStatus {
  Upcoming = "Upcoming",
  Ongoing = "Ongoing",
  Completed = "Completed",
}

export enum TournamentType {
  Unknown = "Unknown",
  Team = "Team",
  Individual = "Individual",
}

export enum TournamentLocationType {
  LAN = "LAN",
  Online = "Online",
}

export enum GameVersion {
  Age1 = "Age of Empires I",
  Age2 = "Age of Empires II",
  Age3 = "Age of Empires III",
  Age4 = "Age of Empires IV",
}

export type Amount = { amount: number; code: "USD" };

export interface TournamentSection {
  title: string;
  data: Tournament[];
}

export interface Tournament {
  game: GameVersion;
  type: TournamentType;
  tier: TournamentCategory;
  name: string;
  path: string;
  start?: Date;
  end?: Date;
  participantsCount: number;
  participants: EventParticipant[];
  prizePool?: Amount;
  location?: {
    name: string;
    country?: Country;
    type: TournamentLocationType;
  };
  league?: {
    name: string;
    image?: string;
    path?: string;
  };
}

export interface EventPlayer {
  name?: string;
  civilization?: string;
  country?: Country;
}

export interface EventParticipant {
  name: string;
  score?: number | string;
  image?: string;
}

export interface Event {
  date: Date;
  format?: string;
  participants: [EventParticipant, EventParticipant];
}

interface Link {
  url: string;
  image?: string;
  text: string;
}

export interface PlayoffGame {
  map: string;
  players?: [EventPlayer[], EventPlayer[]];
  winner?: 0 | 1;
}

export interface PlayoffMatch {
  bestOf?: string;
  name?: string;
  participants: [EventParticipant, EventParticipant] | [EventParticipant];
  winner?: 0 | 1;
  startTime?: Date;
  note?: string;
  links: Link[];
  games: PlayoffGame[];
}

export interface PlayoffRound {
  id: string;
  name: string;
  format?: string;
  matches: PlayoffMatch[];
}

export interface Tab {
  name: string;
  path: string;
  active: boolean;
}

export interface Map {
  name: string;
  path?: string;
  image: string;
  category?: string;
}

export interface Score {
  win: number;
  loss: number;
  draw: number;
}

export interface GroupParticipant extends Omit<EventParticipant, "score"> {
  position?: number;
  matchScore?: Score;
  gameScore?: Score;
  points?: string;
  status: "up" | "stayup" | "stay" | "down";
}

export interface Round {
  name: string;
  matches: PlayoffMatch[];
}

export interface Group {
  name: string;
  participants: GroupParticipant[];
  rounds: Round[];
}

export interface Prize {
  place: string;
  prize?: Amount;
  participants: EventParticipant[];
}

export interface Playoff {
  name?: string;
  rounds: PlayoffRound[];
}

export interface TournamentDetail extends Tournament {
  description: string;
  format: string;
  broadcastTalent?: string;
  rules: string;
  maps: Map[];
  schedule: Event[];
  scheduleNote?: string;
  playoffs: Playoff[];
  participantsNote?: string;
  groups: Group[];
  tabs: Array<Tab[]>;
  results: PlayoffMatch[];
  prizes: Prize[];
  version?: string;
  organizer?: string;
  gameMode?: string;
  venue?: string;
}
