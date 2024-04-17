import maxBy from "lodash/maxBy";
import { HTMLElement } from "node-html-parser";

const srcSetParse = (srcset: string) => {
  const sources = srcset.split(", ");
  return sources.map((source) => {
    const [url, density] = source.split(" ");
    return { url, density: density.replace("x", "") };
  });
};

export const imageUrl = (image?: HTMLElement | null, allowDefault = true) => {
  const defaultPath =
    "/commons/images/thumb/3/35/Age_of_Empires_default_allmode.png/99px-Age_of_Empires_default_allmode.png";
  const baseUrl = "https://liquipedia.net";
  let path = image?.getAttribute("src");

  if (image?.getAttribute("srcset")) {
    path = `${
      maxBy(srcSetParse(image.getAttribute("srcset") ?? ""), "density")?.url
    }`;
  }

  if (!path || path.includes("Logo_filler_event.png")) {
    if (!allowDefault) {
      return "";
    }
    path = defaultPath;
  }
  return baseUrl + path;
};
