declare module "cejs" {
  function run(modules: string[]) {}

  export type WikiData = Array<WikiData | string>;

  export class wiki {
    public static parse(data: string): WikiData {}
  }
}
