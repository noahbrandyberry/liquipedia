import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { Game } from "../types/games";
import {QueryResponse, Response} from "../types/request";

export class Request {
  private request: AxiosInstance;

  constructor(
    game: Game,
    userAgent: string,
    baseURL = "https://liquipedia.net"
  ) {
    this.request = axios.create({
      baseURL: `${baseURL}/${game}`,
      headers: {
        "User-Agent": userAgent,
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
  }

  async get(url: string, config?: AxiosRequestConfig<any>): Promise<Response> {
    const response = await this.request.get<Response>(
      `/api.php?action=parse&origin=*&format=json&page=${url}`,
      config
    );
    return response.data;
  }

  async query(url: string, config?: AxiosRequestConfig<any>): Promise<QueryResponse> {
    const response = await this.request.get<QueryResponse>(
      `/api.php?action=query&format=json&prop=extracts&formatversion=2&exintro=1&titles=${url}`,
      config
    );
    return response.data;
  }
}
