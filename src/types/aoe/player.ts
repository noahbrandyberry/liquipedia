import { Country } from "./country";
import { Amount } from "./tournaments";

export interface Player {
  name: string;
  image?: string;
  overview?: string;
  bio?: string;
  fullName?: string;
  nationality?: Country;
  birthdate?: Date;
  age?: number;
  status?: string;
  yearsActive?: string;
  team?: string;
  totalWinnings?: Amount;
}
