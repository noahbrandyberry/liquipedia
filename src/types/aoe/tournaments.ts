export type TournamentCategory =
  | Age1TournamentCategory
  | Age2TournamentCategory
  | Age3TournamentCategory;

export enum Age1TournamentCategory {
  All = "Age_of_Empires_I/Tournaments",
  TierS = "Age_of_Empires_I/S-Tier_Tournaments",
  TierA = "Age_of_Empires_I/A-Tier_Tournaments",
  TierB = "Age_of_Empires_I/B-Tier_Tournaments",
  TierC = "Age_of_Empires_I/C-Tier_Tournaments",
  ShowMatches = "Age_of_Empires_I/Show_Matches",
  Qualifiers = "Age_of_Empires_I/Qualifier_Tournaments",
}

export enum Age2TournamentCategory {
  All = "Age_of_Empires_II/Tournaments",
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
  All = "Age_of_Empires_III/Tournaments",
  TierS = "Age_of_Empires_III/S-Tier_Tournaments",
  TierA = "Age_of_Empires_III/A-Tier_Tournaments",
  TierB = "Age_of_Empires_III/B-Tier_Tournaments",
  TierC = "Age_of_Empires_III/C-Tier_Tournaments",
  ShowMatches = "Age_of_Empires_III/Show_Matches",
  Qualifiers = "Age_of_Empires_III/Qualifier_Tournaments",
}

export enum Age4TournamentCategory {
  All = "Age_of_Empires_IV/Tournaments",
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
  All = "Age_of_Empires_Online/Tournaments",
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

export interface Tournament {
  type: TournamentType;
  tier: TournamentCategory;
  status: TournamentStatus;
  name: string;
  url: string;
  dates: string;
  participants: number;
  prizePool: string;
  hostLocation?: string;
  winner?: string;
  runnerUp?: string;
  league?: {
    name: string;
    imageUrl?: string;
  };
}
