export interface FileEntry {
  name: string;
  path: string; // root-relative, forward-slashed
  isDir: boolean;
  size: number;
  modTime: string;
  mode: string;
}

export interface ListResponse {
  path: string;
  entries: FileEntry[];
}

/** One image or video in the Photos-style media library (see /api/media). */
export interface MediaItem {
  path: string; // root-relative, forward-slashed
  name: string;
  size: number;
  modTime: string;
  kind: "image" | "video";
}

export interface MediaListResponse {
  items: MediaItem[];
}

export interface ServerSettings {
  baseUrl: string; // e.g. http://100.x.x.x:8080  (your Tailscale IP)
  apiKey: string;
}

/** A saved connection to one Linux backend ("mooni"). */
export interface DeviceProfile {
  id: string;
  name: string; // friendly label, e.g. "Laptop Kamar"
  baseUrl: string; // e.g. http://100.x.x.x:8080  (Tailscale IP + port)
  apiKey: string;
}

/** Pairing code: base64(JSON) pasted from the backend's install script. */
export interface PairingPayload {
  name: string;
  baseUrl: string;
  apiKey: string;
}

/** Snapshot returned by the backend's GET /api/system/stats. */
export interface SystemStats {
  hostname: string;
  os: string;
  uptimeSeconds: number;
  cpuPercent: number;
  loadAvg: number[];
  memory: {
    totalBytes: number;
    availableBytes: number;
    usedPercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
  };
  processes: number;
  tempsCelsius: number[];
}

/** Backend-persisted alert thresholds; 0 disables a metric. */
export interface AlertConfig {
  enabled: boolean;
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  tempCelsius: number;
  cooldownMinutes: number;
}
