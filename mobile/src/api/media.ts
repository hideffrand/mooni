import { AxiosInstance } from "axios";
import { MediaItem, MediaListResponse, ServerSettings } from "../types";
import { createFileUpload } from "./files";

export async function listMedia(client: AxiosInstance): Promise<MediaItem[]> {
  const res = await client.get<MediaListResponse>("/api/media/list");
  return res.data.items ?? [];
}

export function mediaUrl(
  settings: ServerSettings,
  endpoint: "thumb" | "preview",
  path: string
): string {
  const params = new URLSearchParams({ path });
  return `${settings.baseUrl}/api/media/${endpoint}?${params.toString()}`;
}

/** Uploads into the media library root (multipart path field ignored). */
export function uploadMedia(
  baseUrl: string,
  apiKey: string,
  localUri: string,
  onProgress?: (sent: number, total: number) => void
) {
  return createFileUpload(baseUrl, apiKey, "", localUri, onProgress);
}

export async function deleteMedia(client: AxiosInstance, paths: string[]) {
  await client.post("/api/media/delete", { paths });
}
