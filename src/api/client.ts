// Typed client for the BlitterServer contract. Requests go through Tauri's
// HTTP plugin (Rust-side fetch) because the webview origin can't do CORS
// against an arbitrary self-hosted server.
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { components } from "./schema";

export type Schemas = components["schemas"];
export type Artist = Schemas["Artist"];
export type Album = Schemas["Album"];
export type Track = Schemas["Track"];
export type Playlist = Schemas["Playlist"];
export type Profile = Schemas["Profile"];
export type LibrarySummary = Schemas["Library"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    title?: string,
  ) {
    super(title || `HTTP ${status}`);
  }
}

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

/** One connected BlitterServer + bearer token. */
export class Client {
  constructor(
    public baseUrl: string,
    private token?: string,
  ) {}

  withToken(token: string): Client {
    return new Client(this.baseUrl, token);
  }

  url(path: string): string {
    return this.baseUrl.replace(/\/$/, "") + path;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const resp = await tauriFetch(this.url(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (resp.status === 204) return null as T;
    const isJSON = (resp.headers.get("Content-Type") ?? "").includes("json");
    const payload = isJSON ? await resp.json().catch(() => null) : null;
    if (!resp.ok) {
      throw new ApiError(resp.status, payload?.code ?? "", payload?.title);
    }
    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  // ---- typed conveniences used across the app ----

  ping() {
    return this.get<{ name: string; version: string; setupComplete?: boolean }>("/v1/ping");
  }

  startPairing(deviceName: string) {
    return this.post<{ pairingId: string; code: string; expiresAt: string }>("/v1/pair", {
      deviceName,
      deviceType: "desktop",
    });
  }

  getPairing(pairingId: string) {
    return this.get<{ status: string; token?: string | null; deviceId?: string | null }>(
      `/v1/pair/${pairingId}`,
    );
  }

  listProfiles() {
    return this.get<Profile[]>("/v1/profiles");
  }

  createProfileToken(profileId: string, pin?: string) {
    return this.post<{ token: string; profile: Profile }>("/v1/profile-tokens", {
      profileId,
      pin,
    });
  }

  library() {
    return this.get<LibrarySummary>("/v1/library");
  }

  albums(cursor?: string) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.get<Page<Album>>(`/v1/albums${q}`);
  }

  albumTracks(albumId: string) {
    return this.get<Track[]>(`/v1/albums/${albumId}/tracks`);
  }

  artists(cursor?: string) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.get<Page<Artist>>(`/v1/artists${q}`);
  }

  streamGrant(trackId: string) {
    return this.post<{ url: string; expiresAt: string }>("/v1/stream-grants", { trackId });
  }

  private artCache = new Map<string, Promise<string>>();

  /** Fetches artwork with the bearer header (an <img> tag can't carry one)
   * and returns a cached object URL. */
  loadArt(artId: string, size = 300): Promise<string> {
    const key = `${artId}@${size}`;
    let cached = this.artCache.get(key);
    if (!cached) {
      cached = (async () => {
        const resp = await tauriFetch(this.url(`/v1/art/${artId}?w=${size}&h=${size}`), {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        });
        if (!resp.ok) throw new ApiError(resp.status, "art_unavailable");
        return URL.createObjectURL(await resp.blob());
      })();
      cached.catch(() => this.artCache.delete(key));
      this.artCache.set(key, cached);
    }
    return cached;
  }
}
