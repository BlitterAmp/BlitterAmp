import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { AlbumArt } from "../AlbumArt";

function fmt(ms: number): string {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

export function AlbumView({
  client,
  player,
  albumId,
  onBack,
}: {
  client: Client;
  player: Player;
  albumId: string;
  onBack: () => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .albumTracks(albumId)
      .then(setTracks)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the album."));
  }, [client, albumId]);

  const first = tracks[0];

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Albums
      </button>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      {first && (
        <div className="mb-6 flex gap-6">
          <div className="size-48 shrink-0 overflow-hidden rounded-box shadow-lg">
            <AlbumArt client={client} artId={first.artId} size={600} alt={first.albumTitle} />
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-xs uppercase tracking-wider opacity-50">Album</div>
            <h1 className="text-3xl font-bold">{first.albumTitle}</h1>
            <div className="mt-1 opacity-70">{first.artistName}</div>
            <button type="button" className="btn btn-primary mt-4 w-fit gap-2" onClick={() => void player.playQueue(tracks)}>
              <Play size={16} /> Play
            </button>
          </div>
        </div>
      )}

      <table className="table table-sm">
        <tbody>
          {tracks.map((t, i) => (
            <tr key={t.trackId} className="hover cursor-pointer" onClick={() => void player.playQueue(tracks, i)}>
              <td className="w-10 text-right tabular-nums opacity-50">{t.index ?? i + 1}</td>
              <td>
                {t.title}
                {!player.canPlay(t) && (
                  <span className="ml-2 text-xs opacity-50">({t.media.container} — needs the mpv engine)</span>
                )}
              </td>
              <td className="w-16 text-right tabular-nums opacity-60">{fmt(t.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
