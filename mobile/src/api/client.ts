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

/** True when the request never got a response (timeout, network failure, DNS). */
export function isUnreachable(e: any): boolean {
  return (
    e?.code === "ECONNABORTED" ||
    e?.code === "ERR_NETWORK" ||
    (!e?.response && !!e?.request)
  );
}

export function fileUrl(
  settings: ServerSettings,
  endpoint: "download" | "preview" | "thumb",
  path: string
): string {
  const params = new URLSearchParams({ path });
  return `${settings.baseUrl}/api/files/${endpoint}?${params.toString()}`;
}
