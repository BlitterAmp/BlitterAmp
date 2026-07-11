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
    <div className="album-detail">
      <button type="button" className="breadcrumb-link nav-item" onClick={onBack}>
        <ArrowLeft size={13} /> Albums
      </button>
      {error && <div className="signin-error">{error}</div>}
      {first && (
        <div className="album-header">
          <div className="album-header-art">
            <AlbumArt client={client} artId={first.artId} size={600} alt={first.albumTitle} />
          </div>
          <div>
            <div className="album-meta-label">Album</div>
            <h1 className="album-meta-title">{first.albumTitle}</h1>
            <div className="album-meta-by">{first.artistName}</div>
            <div className="album-actions">
              <button type="button" className="action-play" onClick={() => void player.playQueue(tracks)}>
                <Play size={16} /> Play
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="track-list">
        {tracks.map((t, i) => (
          <button
            type="button"
            key={t.trackId}
            className="track-row"
            onDoubleClick={() => void player.playQueue(tracks, i)}
            onClick={() => void player.playQueue(tracks, i)}
          >
            <span className="track-num">{t.index ?? i + 1}</span>
            <span className="track-main">
              <span className="track-title">{t.title}</span>
              {!player.canPlay(t) && <span className="track-rowsub"> ({t.media.container} — needs the mpv engine)</span>}
            </span>
            <span className="track-duration">{fmt(t.durationMs)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
