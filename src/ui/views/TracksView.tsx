import { useEffect, useState } from "react";
import type { Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibraryVersion } from "../../state/useLibrarySync";
import { TrackList, type NavTarget } from "../TrackList";

export function TracksView({
  client,
  player,
  onNavigate,
}: {
  client: Client;
  player: Player;
  onNavigate: (t: NavTarget) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const libVersion = useLibraryVersion(client);

  async function loadMore(from?: string) {
    try {
      const page = await client.tracks(from);
      setTracks((prev) => (from ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tracks.");
    }
  }

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, libVersion]);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Tracks</h1>
        <span className="text-sm opacity-60">{tracks.length} loaded</span>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} showAlbum />
      {cursor && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn btn-sm" onClick={() => void loadMore(cursor)}>
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
