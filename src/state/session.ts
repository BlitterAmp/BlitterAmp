// Connection/session state: which BlitterServer, which device token, which
// profile. Persisted via the Tauri store plugin under the app's data dir.
import { load, type Store } from "@tauri-apps/plugin-store";
import { Client, type Profile } from "../api/client";

export interface SavedSession {
  serverUrl: string;
  deviceToken: string;
  profileToken?: string;
  profile?: Profile;
}

const STORE_FILE = "session.json";
const KEY = "session";

let store: Store | null = null;

async function backing(): Promise<Store> {
  if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  return store;
}

export async function loadSession(): Promise<SavedSession | null> {
  const s = await backing();
  return ((await s.get<SavedSession>(KEY)) as SavedSession | undefined) ?? null;
}

export async function saveSession(session: SavedSession): Promise<void> {
  const s = await backing();
  await s.set(KEY, session);
}

export async function clearSession(): Promise<void> {
  const s = await backing();
  await s.delete(KEY);
}

/** Builds the profile-scoped client for a restored session, or null when the
 * saved tokens no longer work (revoked, server reset). */
export async function restore(): Promise<{ client: Client; session: SavedSession } | null> {
  const session = await loadSession();
  if (!session?.serverUrl || !session.profileToken) return null;
  const client = new Client(session.serverUrl, session.profileToken);
  try {
    await client.get("/v1/me");
    return { client, session };
  } catch {
    return null;
  }
}
