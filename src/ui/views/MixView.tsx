import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { MosaicArt } from "../MosaicArt";
import { PlayActions } from "../PlayActions";
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
      <div className="mb-6 flex gap-6">
        <div className="size-48 shrink-0 overflow-hidden rounded-box shadow-lg">
          <MosaicArt artIds={tracks.map((t) => t.artId)} size={384} alt={title} />
        </div>
        <div className="flex flex-col justify-end">
          <div className="text-xs uppercase tracking-wider opacity-50">Mix</div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="mt-1 text-sm opacity-60">{tracks.length} tracks</div>
          <div className="mt-4">
            <PlayActions player={player} tracks={tracks} />
          </div>
        </div>
      </div>
      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} showAlbum />
    </section>
  );
}
