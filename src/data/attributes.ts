import { HTMLElement } from "node-html-parser";
import { getPath } from "./url";

export const getAttributes = (htmlRoot: HTMLElement) => {
  const attributes: Record<
    string,
    { path?: string; text: string; element: HTMLElement }[] | undefined
  > = {};

  htmlRoot.querySelectorAll(".infobox-description").forEach((info) => {
    const anchors = info.nextElementSibling.querySelectorAll(":scope > a");
    const attributeValues =
      anchors.length > 0
        ? info.nextElementSibling
            .querySelectorAll(":scope > a")
            .map((anchor) => ({
              path: getPath(anchor),
              text: anchor.textContent,
              element: anchor,
            }))
        : [
            {
              text: info.nextElementSibling.textContent,
              element: info.nextElementSibling,
            },
          ];
    attributes[info.textContent.trim().replace(/.$/, "")] = attributeValues;
  });

  return attributes;
};
