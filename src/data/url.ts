import { HTMLElement } from "node-html-parser";
import { Game } from "../types/games";

export const getPath = (anchor: HTMLElement | null) => {
  return anchor?.getAttribute("href")?.replace(`/${Game.AOE}/`, "");
};
