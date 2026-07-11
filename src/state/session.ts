// Connection/session state: which BlitterServer, which device token, which
// profile. Persisted via the Tauri store plugin under the app's data dir.
import { load, type Store } from "@tauri-apps/plugin-store";
import { ApiError, Client } from "../api/client";
import type { Profile } from "../api/client";

export interface SavedSession {
  serverUrl: string;
  deviceToken: string;
  profileToken?: string;
  profile?: Profile;
}

const STORE_FILE = "session.json";
const KEY = "session";
const LAST_URL_KEY = "lastServerUrl";

/** The URL probed automatically on first run: a BlitterServer on the same
 * machine (the bundled-engine story, and the common dev setup). */
export const DEFAULT_LOCAL_URL = "http://127.0.0.1:8484";

let store: Store | null = null;

async function backing(): Promise<Store> {
  if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  return store;
}

export async function loadSession(): Promise<SavedSession | null> {
  const s = await backing();
  return ((await s.get<SavedSession>(KEY)) as SavedSession | undefined) ?? null;
}

/** Persists immediately — the device token is delivered by the server exactly
 * once, so it must never be lost to an autosave debounce and a fast quit. */
export async function saveSession(session: SavedSession): Promise<void> {
  const s = await backing();
  await s.set(KEY, session);
  await s.set(LAST_URL_KEY, session.serverUrl);
  await s.save();
}

export async function clearSession(): Promise<void> {
  const s = await backing();
  await s.delete(KEY);
  await s.save();
}

export async function lastServerUrl(): Promise<string> {
  const s = await backing();
  return ((await s.get<string>(LAST_URL_KEY)) as string | undefined) ?? DEFAULT_LOCAL_URL;
}

export async function saveLastServerUrl(url: string): Promise<void> {
  const s = await backing();
  await s.set(LAST_URL_KEY, url);
  await s.save();
}

export type Restored =
  | { kind: "profile"; client: Client; session: SavedSession }
  | { kind: "device"; client: Client; session: SavedSession }
  | { kind: "none" };

/** Rebuilds the session saved on disk.
 *
 * - profile token valid → straight into the app
 * - profile token rejected but device token present → profile picker
 * - transient network failure → retried; only auth rejections clear state
 */
export async function restore(retries = 3, delayMs = 700): Promise<Restored> {
  const session = await loadSession();
  if (!session?.serverUrl || !session.deviceToken) return { kind: "none" };

  if (session.profileToken) {
    const client = new Client(session.serverUrl, session.profileToken);
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await client.get("/v1/me");
        return { kind: "profile", client, session };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          break; // token revoked/dead — fall through to the device token
        }
        // Network hiccup (server still starting, sleep/wake) — retry.
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // Profile token unusable; the device token may still let us pick a profile.
  const deviceClient = new Client(session.serverUrl, session.deviceToken);
  try {
    await deviceClient.get("/v1/me");
    return { kind: "device", client: deviceClient, session };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      await clearSession(); // device revoked server-side — start over
      return { kind: "none" };
    }
    // Server unreachable: keep the session for next time, sign-in for now.
    return { kind: "none" };
  }
}
