import { AxiosInstance } from "axios";
import { MediaBrowseResponse, MediaItem, MediaListResponse, ServerSettings } from "../types";
import { createFileUpload } from "./files";

export async function listMedia(client: AxiosInstance): Promise<MediaItem[]> {
  const res = await client.get<MediaListResponse>("/api/media/list");
  return res.data.items ?? [];
}

/** Scoped listing of one library folder: subfolders (albums) + direct items. */
export async function listMediaFolders(
  client: AxiosInstance,
  path: string
): Promise<MediaBrowseResponse> {
  const res = await client.get<MediaBrowseResponse>("/api/media/list", {
    params: { mode: "browse", path },
  });
  // Older backend binaries don't send the album keys; never let undefined leak.
  return {
    path: res.data.path ?? path,
    folders: res.data.folders ?? [],
    items: res.data.items ?? [],
  };
}

export function mediaUrl(
  settings: ServerSettings,
  endpoint: "thumb" | "preview",
  path: string,
  tier?: "large"
): string {
  const params = new URLSearchParams({ path });
  if (tier) params.set("tier", tier);
  return `${settings.baseUrl}/api/media/${endpoint}?${params.toString()}`;
}

/** Uploads into the given media library folder via /api/media/upload. */
export function uploadMedia(
  baseUrl: string,
  apiKey: string,
  destDir: string,
  localUri: string,
  onProgress?: (sent: number, total: number) => void
) {
  return createFileUpload(baseUrl, apiKey, destDir, localUri, onProgress, "/api/media/upload");
}

export async function deleteMedia(client: AxiosInstance, paths: string[]) {
  await client.post("/api/media/delete", { paths });
}
