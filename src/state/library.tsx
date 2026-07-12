// The whole catalog, mirrored locally by the Rust host (see src-tauri/library.rs)
// and rendered without pagination. On connect we point the mirror at the server
// (library_configure), read the full snapshot, and re-read whenever the mirror
// moves (the `library:changed` event, driven by SSE). Views consume useLibrary()
// and render everything — no "Load more", and on a remote server nothing is
// re-fetched when the library is unchanged.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Album, Artist, Playlist, Track } from "../api/client";
import type { Connection } from "./connection";

interface Snapshot {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  playlists: Playlist[];
}

export interface Library extends Snapshot {
  ready: boolean;
  albumById: Map<string, Album>;
  artistById: Map<string, Artist>;
  albumsByArtist: Map<string, Album[]>;
  tracksByAlbum: Map<string, Track[]>;
  tracksByArtist: Map<string, Track[]>;
  reload: () => void;
}

const empty: Snapshot = { artists: [], albums: [], tracks: [], playlists: [] };

const LibraryContext = createContext<Library | null>(null);

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function LibraryProvider({
  connection,
  children,
}: {
  connection: Connection;
  children: React.ReactNode;
}) {
  const [snap, setSnap] = useState<Snapshot>(empty);
  const [ready, setReady] = useState(false);

  async function load() {
    try {
      const s = await invoke<Snapshot>("library_snapshot");
      setSnap(s);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    setReady(false);
    setSnap(empty);
    const identity = connection.kind === "local" ? "local" : (connection.remoteUrl ?? "remote");
    void invoke("library_configure", {
      baseUrl: connection.client.baseUrl,
      token: connection.client.authToken ?? "",
      identity,
    })
      .then(load)
      .catch(() => load());
    const unlisten = listen("library:changed", () => void load());
    return () => void unlisten.then((f) => f());
  }, [connection]);

  const value = useMemo<Library>(() => {
    const bySortedTitle = <T extends { title?: string; name?: string }>(a: T, b: T) =>
      (a.title ?? a.name ?? "").localeCompare(b.title ?? b.name ?? "");
    const albums = [...snap.albums].sort(bySortedTitle);
    const artists = [...snap.artists].sort(bySortedTitle);
    const tracks = [...snap.tracks].sort(bySortedTitle);
    const playlists = [...snap.playlists].sort(bySortedTitle);
    return {
      artists,
      albums,
      tracks,
      playlists,
      ready,
      albumById: new Map(albums.map((a) => [a.albumId, a])),
      artistById: new Map(artists.map((a) => [a.artistId, a])),
      albumsByArtist: group(albums, (a) => a.artistId),
      tracksByAlbum: group(tracks, (t) => t.albumId),
      tracksByArtist: group(tracks, (t) => t.artistId),
      reload: load,
    };
  }, [snap, ready]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): Library {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

/** Nudge the Rust mirror to pull a delta now (after a mutation we made). */
export function resyncLibrary(): void {
  void invoke("library_resync");
}
