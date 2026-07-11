import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { TrackList, type NavTarget } from "../TrackList";

export function MixView({
  client,
  player,
  mixId,
  title,
  onNavigate,
  onBack,
}: {
  client: Client;
  player: Player;
  mixId: string;
  title: string;
  onNavigate: (t: NavTarget) => void;
  onBack: () => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .mixTracks(mixId)
      .then(setTracks)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the mix."));
  }, [client, mixId]);

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider opacity-50">Mix</div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-primary gap-2" disabled={!tracks.length} onClick={() => void player.playQueue(tracks)}>
            <Play size={16} /> Play
          </button>
          <button type="button" className="btn gap-2" disabled={!tracks.length} onClick={() => { player.toggleShuffle(); void player.playQueue(tracks); }}>
            <Shuffle size={15} /> Shuffle
          </button>
        </div>
      </div>
      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} showAlbum />
    </section>
  );
}
