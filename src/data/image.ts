import maxBy from "lodash/maxBy";
import { HTMLElement } from "node-html-parser";

const srcSetParse = (srcset: string) => {
  const sources = srcset.split(", ");
  return sources.map((source) => {
    const [url, density] = source.split(" ");
    return { url, density: density.replace("x", "") };
  });
};

export const imageUrl = (image?: HTMLElement | null) => {
  const baseUrl = "https://liquipedia.net";
  let path =
    image?.getAttribute("src") ??
    "/commons/images/thumb/3/35/Age_of_Empires_default_allmode.png/99px-Age_of_Empires_default_allmode.png";

  if (image?.getAttribute("srcset")) {
    path = `${
      maxBy(srcSetParse(image.getAttribute("srcset") ?? ""), "density")?.url
    }`;
  }

  return baseUrl + path;
};
