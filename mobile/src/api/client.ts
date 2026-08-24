import axios, { AxiosInstance } from "axios";
import { ServerSettings } from "../types";

export function createClient(settings: ServerSettings): AxiosInstance {
  return axios.create({
    baseURL: settings.baseUrl,
    timeout: 15000,
    headers: {
      "X-API-Key": settings.apiKey,
    },
  });
}

export function fileUrl(
  settings: ServerSettings,
  endpoint: "download" | "preview" | "thumb",
  path: string
): string {
  const params = new URLSearchParams({ path });
  return `${settings.baseUrl}/api/files/${endpoint}?${params.toString()}`;
}
