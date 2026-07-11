// Persisted connection state. In the always-connected model this holds ONLY a
// remote session the user opted into via Settings; its absence means "use the
// bundled local engine" (the default). Persisted via the Tauri store plugin.
import { load, type Store } from "@tauri-apps/plugin-store";
import type { Profile } from "../api/client";

export interface SavedSession {
  serverUrl: string;
  deviceToken: string;
  profileToken?: string;
  profile?: Profile;
  /** false marks an explicit remote session (vs. the default local engine). */
  managed?: boolean;
}

const STORE_FILE = "session.json";
const KEY = "session";

/** The port a user-run BlitterServer conventionally listens on (offered as
 * the default when connecting to a remote). */
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

/** Persists immediately (device tokens are delivered by the server exactly
 * once, so they must never be lost to an autosave debounce). */
export async function saveSession(session: SavedSession): Promise<void> {
  const s = await backing();
  await s.set(KEY, session);
  await s.save();
}

export async function clearSession(): Promise<void> {
  const s = await backing();
  await s.delete(KEY);
  await s.save();
}
