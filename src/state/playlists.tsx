import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Client, Playlist } from "../api/client";

interface PlaylistsCtx {
  playlists: Playlist[];
  refresh: () => Promise<void>;
  create: (title: string) => Promise<Playlist>;
  append: (playlistId: string, trackIds: string[]) => Promise<void>;
  rename: (playlistId: string, title: string) => Promise<void>;
  remove: (playlistId: string) => Promise<void>;
}

const Ctx = createContext<PlaylistsCtx | null>(null);

export function PlaylistsProvider({ client, children }: { client: Client; children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const refresh = useCallback(async () => {
    try {
      setPlaylists((await client.listPlaylists()) ?? []);
    } catch {
      /* leave the last-known list on transient failure */
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (title: string) => {
      const p = await client.createPlaylist({ title });
      await refresh();
      return p;
    },
    [client, refresh],
  );
  const append = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      await client.appendPlaylistTracks(playlistId, trackIds);
      await refresh();
    },
    [client, refresh],
  );
  const rename = useCallback(
    async (playlistId: string, title: string) => {
      await client.updatePlaylist(playlistId, { title });
      await refresh();
    },
    [client, refresh],
  );
  const remove = useCallback(
    async (playlistId: string) => {
      await client.deletePlaylist(playlistId);
      await refresh();
    },
    [client, refresh],
  );

  return <Ctx.Provider value={{ playlists, refresh, create, append, rename, remove }}>{children}</Ctx.Provider>;
}

export function usePlaylists(): PlaylistsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlaylists outside PlaylistsProvider");
  return ctx;
}
