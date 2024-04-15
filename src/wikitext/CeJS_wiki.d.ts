export type WikiData = Array<WikiData | string>;

declare class wiki {
  public static parse(data: string): WikiData {}
}

export { wiki };
