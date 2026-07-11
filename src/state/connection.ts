// The app is ALWAYS connected — either to the bundled local engine (default,
// like a native music app) or to a remote BlitterServer the user opted into
// via Settings. There is no sign-in gate; a failed remote simply falls back
// to local. Admin/management is available only for the local engine.
import { AdminClient } from "../admin/adminClient";
import { Client } from "../api/client";
import { startEngine } from "./engine";
import { clearSession, loadSession, saveSession, type SavedSession } from "./session";

export interface Connection {
  kind: "local" | "remote";
  client: Client;
  profileName: string;
  /** Present only for local connections — powers native Settings management. */
  admin?: AdminClient;
  /** For remote connections: the server the user can open in a browser. */
  remoteUrl?: string;
}

/** Resolves the current connection on launch: a working saved remote session,
 * otherwise the bundled engine. Never fails to a sign-in screen. */
export async function resolveConnection(): Promise<Connection> {
  const saved = await loadSession();
  if (saved?.managed === false && saved.profileToken && saved.serverUrl) {
    const client = new Client(saved.serverUrl, saved.profileToken);
    if (await validates(client)) {
      return { kind: "remote", client, profileName: saved.profile?.name ?? "", remoteUrl: saved.serverUrl };
    }
    // Remote unreachable/revoked — quietly fall back to the local engine.
  }
  return connectLocal();
}

/** Starts (or restarts) the bundled engine and returns a local connection. */
export async function connectLocal(): Promise<Connection> {
  const { client, info } = await startEngine();
  return {
    kind: "local",
    client,
    profileName: info.profile_name,
    admin: new AdminClient(info.base_url),
  };
}

/** Persists a remote session chosen in Settings and returns its connection. */
export async function adoptRemote(session: SavedSession): Promise<Connection> {
  await saveSession({ ...session, managed: false });
  return {
    kind: "remote",
    client: new Client(session.serverUrl, session.profileToken!),
    profileName: session.profile?.name ?? "",
    remoteUrl: session.serverUrl,
  };
}

/** Drops any remote session, returning to the local engine. */
export async function useLocal(): Promise<Connection> {
  await clearSession();
  return connectLocal();
}

async function validates(client: Client): Promise<boolean> {
  try {
    await client.get("/v1/me");
    return true;
  } catch {
    return false;
  }
}
