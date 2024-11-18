export type RequestHeaders = {
  acceptEncoding?: "gzip" | "compress" | "deflate" | "br" | "identity" | "*";
  userAgent?: string;
};

export type RequestOptions = {
  url: string;
  headers?: RequestHeaders;
};

export type Response = {
  parse: {
    displaytitle: string;
    text: {
      "*": string;
    };
    wikitext: {
      "*": string;
    };
    title: string;
    pageid: number;
  };
};

export type QueryResponse = {
  batchcomplete: boolean
  warnings: {
    extracts: {
      warnings: string
    }
  }
  query: {
    pages: Array<{
      pageid: number
      ns: number
      title: string
      extract: string
    }>
  }
};

export default interface RequestClient {
  get(request: RequestOptions): Promise<Response>;
}
