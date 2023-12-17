import srcSetParse from "srcset-parse";
import maxBy from "lodash/maxBy";
import { HTMLElement } from "node-html-parser";

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
