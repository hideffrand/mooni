import { AxiosInstance } from "axios";
import * as FileSystem from "expo-file-system/legacy";
import ReactNativeBlobUtil from "react-native-blob-util";
import { ListResponse } from "../types";

export async function listFiles(
  client: AxiosInstance,
  path: string
): Promise<ListResponse> {
  const res = await client.get<ListResponse>("/api/files/list", {
    params: { path },
  });
  return res.data;
}

export async function mkdir(client: AxiosInstance, path: string) {
  await client.post("/api/files/mkdir", { path });
}

export async function rename(
  client: AxiosInstance,
  oldPath: string,
  newPath: string
) {
  await client.post("/api/files/rename", { oldPath, newPath });
}

export async function copyItem(
  client: AxiosInstance,
  src: string,
  dst: string
) {
  await client.post("/api/files/copy", { src, dst });
}

export async function moveItem(
  client: AxiosInstance,
  src: string,
  dst: string
) {
  await client.post("/api/files/move", { src, dst });
}

export async function deleteItem(client: AxiosInstance, path: string) {
  await client.delete("/api/files/delete", { data: { path } });
}

export type UploadProgressCallback = (bytesSent: number, totalBytes: number) => void;

/**
 * Multipart upload into destDir via createUploadTask (the only variant
 * exposing progress callbacks). Returns { uploadAsync, cancel }.
 */
export function createFileUpload(
  baseUrl: string,
  apiKey: string,
  destDir: string,
  localUri: string,
  onProgress?: UploadProgressCallback,
  endpoint = "/api/files/upload"
) {
  const url = `${baseUrl}${endpoint}`;
  const task = FileSystem.createUploadTask(
    url,
    localUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      parameters: { path: destDir },
      headers: { "X-API-Key": apiKey },
    },
    onProgress
      ? (data) => onProgress(data.totalBytesSent, data.totalBytesExpectedToSend)
      : undefined
  );

  return {
    uploadAsync: async (): Promise<void> => {
      const result = await task.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error(`Upload failed (${result?.status}): ${result?.body ?? "no response"}`);
      }
    },
    cancel: () => task.cancelAsync(),
  };
}

/** Convenience wrapper for a single fire-and-await upload with progress. */
export async function uploadFile(
  baseUrl: string,
  apiKey: string,
  destDir: string,
  localUri: string,
  onProgress?: UploadProgressCallback
): Promise<void> {
  const { uploadAsync } = createFileUpload(baseUrl, apiKey, destDir, localUri, onProgress);
  await uploadAsync();
}

export type DownloadProgressCallback = (bytesWritten: number, totalBytes: number) => void;

/** Downloads a remote file and returns the local URI. */
export async function downloadFile(
  baseUrl: string,
  apiKey: string,
  remotePath: string,
  fileName: string,
  onProgress?: DownloadProgressCallback
): Promise<string> {
  const url = `${baseUrl}/api/files/download?path=${encodeURIComponent(
    remotePath
  )}`;
  const localUri = `${FileSystem.documentDirectory}${fileName}`;
  // createDownloadResumable (not downloadAsync) is what exposes progress.
  const resumable = FileSystem.createDownloadResumable(
    url,
    localUri,
    { headers: { "X-API-Key": apiKey } },
    onProgress
      ? (data) =>
          onProgress(data.totalBytesWritten, data.totalBytesExpectedToWrite)
      : undefined
  );
  const result = await resumable.downloadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed (${result?.status})`);
  }
  return result.uri;
}

function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf(".");
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""];
}

/** Picks `name.ext`, then `name (2).ext`, ... — first name not taken on disk. */
async function uniqueDownloadPath(dir: string, fileName: string): Promise<string> {
  const [base, ext] = splitExt(fileName);
  let candidate = `${dir}/${fileName}`;
  for (let n = 2; await ReactNativeBlobUtil.fs.exists(candidate); n++) {
    candidate = `${dir}/${base} (${n})${ext}`;
  }
  return candidate;
}

/**
 * Streams a file into the public Downloads/mooni folder via the Android
 * DownloadManager (notification + system-progress included). Needs the
 * react-native-blob-util native module, so it only works in dev/eas builds.
 */
export async function downloadToDownloads(
  baseUrl: string,
  apiKey: string,
  remotePath: string,
  fileName: string
): Promise<string> {
  const url = `${baseUrl}/api/files/download?path=${encodeURIComponent(
    remotePath
  )}`;
  const dir = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/mooni`;
  await ReactNativeBlobUtil.fs.mkdir(dir).catch(() => {}); // usually "already exists"
  const dest = await uniqueDownloadPath(dir, fileName);
  const res = await ReactNativeBlobUtil.config({
    fileCache: false,
    addAndroidDownloads: {
      useDownloadManager: true,
      notification: true,
      title: fileName,
      description: "Downloading via Mooni",
      mime: "application/octet-stream",
      path: dest,
      mediaScannable: true,
    },
  }).fetch("GET", url, { "X-API-Key": apiKey });
  const status = res.info().status;
  if (status < 200 || status >= 300) {
    throw new Error(`Download failed (${status})`);
  }
  return dest;
}

export interface BatchDownloadResult {
  saved: number;
  failed: number;
  /** Files that landed in app storage because the Downloads save failed. */
  fallbacks: number;
}

/**
 * Sequential batch download into Downloads/mooni with per-file fallback to
 * app storage. onEach reports progress as (done, total).
 */
export async function downloadSelected(
  baseUrl: string,
  apiKey: string,
  paths: string[],
  onEach?: (done: number, total: number) => void
): Promise<BatchDownloadResult> {
  let saved = 0;
  let failed = 0;
  let fallbacks = 0;
  for (let i = 0; i < paths.length; i++) {
    const name = paths[i].split("/").pop() ?? `file-${i}`;
    try {
      await downloadToDownloads(baseUrl, apiKey, paths[i], name);
      saved++;
    } catch {
      try {
        await downloadFile(baseUrl, apiKey, paths[i], name);
        saved++;
        fallbacks++;
      } catch {
        failed++;
      }
    }
    onEach?.(i + 1, paths.length);
  }
  return { saved, failed, fallbacks };
}