import { AxiosInstance } from "axios";
import { AlertConfig, SystemStats } from "../types";

export async function getSystemStats(client: AxiosInstance): Promise<SystemStats> {
  const res = await client.get<SystemStats>("/api/system/stats");
  return res.data;
}

export type PowerAction = "reboot" | "shutdown" | "lock";

export async function getConfirmToken(client: AxiosInstance): Promise<string> {
  const res = await client.post<{ token: string }>("/api/system/confirm-token");
  return res.data.token;
}

export async function powerAction(
  client: AxiosInstance,
  action: PowerAction,
  confirmToken: string
): Promise<void> {
  await client.post(`/api/system/${action}`, null, {
    headers: { "X-Confirm-Token": confirmToken },
  });
}

export async function getAlertConfig(client: AxiosInstance): Promise<AlertConfig> {
  const res = await client.get<AlertConfig>("/api/system/alerts");
  return res.data;
}

export async function updateAlertConfig(
  client: AxiosInstance,
  config: AlertConfig
): Promise<AlertConfig> {
  const res = await client.put<AlertConfig>("/api/system/alerts", config);
  return res.data;
}

export async function registerPushToken(
  client: AxiosInstance,
  token: string
): Promise<void> {
  await client.post("/api/system/push-token", { token });
}
