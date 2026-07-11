// Front-end bridge to the Rust bundled-engine manager. Rust owns the process
// and all admin-cookie provisioning; the app only receives a ready bearer
// profile token.
import { invoke } from "@tauri-apps/api/core";
import { Client } from "../api/client";

export interface EngineInfo {
  base_url: string;
  profile_token: string;
  profile_name: string;
}

/** Spawns + provisions the bundled BlitterServer and returns a connected
 * client. Idempotent across launches (reuses the stored profile token). */
export async function startEngine(): Promise<{ client: Client; info: EngineInfo }> {
  const info = await invoke<EngineInfo>("engine_start");
  return { client: new Client(info.base_url, info.profile_token), info };
}

export async function stopEngine(): Promise<void> {
  await invoke("engine_stop");
}

/** Points the managed engine at a music directory and starts a scan. */
export async function setEngineSource(baseUrl: string, path: string): Promise<void> {
  await invoke("engine_set_source", { baseUrl, path });
}
