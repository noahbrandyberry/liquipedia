import { WikiData } from "../wikitext/CeJS_wiki";

// Formats:
// ``` [
//   "Map",
//   ["map", "=", "Slopes"],
//   ["winner", "=", "1"],
//   ["civs1", "=", "eth"],
//   ["civs2", "=", "sla"],
// ]; ```
// as
// ```
// {templateName: "Map", map: slopes}
// ```

export const parseTemplate = (
  data?: WikiData | string
): { templateName: string; [name: string]: undefined | string | WikiData } => {
  if (
    !data ||
    typeof data === "string" ||
    typeof data[0] !== "string" ||
    data.slice(1).some((row) => typeof row === "string")
  ) {
    return { templateName: "N/A" };
  }

  return {
    templateName: data[0],
    ...data
      .slice(1)
      .reduce<{ [name: string]: string | WikiData }>(
        (acc, [key, separator, value]) => {
          if (separator === "=") {
            acc[key.toString()] = value;
          } else {
            acc["value"] = key;
          }
          return acc;
        },
        {}
      ),
  };
};
