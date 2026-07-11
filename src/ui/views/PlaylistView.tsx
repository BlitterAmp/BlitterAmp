import { ArrowLeft, Pencil, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, PlaylistTrack, Playlist } from "../../api/client";
import type { Player } from "../../audio/player";
import { usePlaylists } from "../../state/playlists";
import { TrackList, type NavTarget } from "../TrackList";

export function PlaylistView({
  client,
  player,
  playlistId,
  onNavigate,
  onBack,
  onDeleted,
}: {
  client: Client;
  player: Player;
  playlistId: string;
  onNavigate: (t: NavTarget) => void;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const { rename, remove } = usePlaylists();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistTrack[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setPlaylist(await client.getPlaylist(playlistId));
      const all: PlaylistTrack[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.playlistTracks(playlistId, cursor);
        all.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the playlist.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, playlistId]);

  const owned = playlist?.origin === "blitterserver";

  async function doRename() {
    const next = window.prompt("Playlist name", playlist?.title);
    if (!next || next === playlist?.title) return;
    await rename(playlistId, next);
    await load();
  }

  async function doDelete() {
    if (!window.confirm(`Delete "${playlist?.title}"?`)) return;
    await remove(playlistId);
    onDeleted();
  }

  async function removeItem(itemId: string) {
    await client.removePlaylistTrack(playlistId, itemId);
    await load();
  }

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      {playlist && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider opacity-50">Playlist</div>
          <h1 className="text-3xl font-bold">{playlist.title}</h1>
          <div className="mt-1 text-sm opacity-60">
            {items.length} tracks{playlist.ownerName ? ` · by ${playlist.ownerName}` : ""}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" className="btn btn-primary gap-2" disabled={items.length === 0} onClick={() => void player.playQueue(items)}>
              <Play size={16} /> Play
            </button>
            {owned && (
              <>
                <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void doRename()}>
                  <Pencil size={14} /> Rename
                </button>
                <button type="button" className="btn btn-ghost btn-sm gap-1 text-error" onClick={() => void doDelete()}>
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <TrackList
        client={client}
        player={player}
        tracks={items}
        onNavigate={onNavigate}
        showAlbum
        onRemove={owned ? (t) => void removeItem((t as PlaylistTrack).itemId) : undefined}
      />
    </section>
  );
}
