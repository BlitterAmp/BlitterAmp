import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client } from "../api/client";
import type { Player, PlayerState } from "../audio/player";
import { AlbumArt } from "./AlbumArt";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlayingBar({ client, player }: { client: Client; player: Player }) {
  const [state, setState] = useState<PlayerState>({
    track: null,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    error: "",
  });
  useEffect(() => player.subscribe(setState), [player]);

  const t = state.track;
  const progress = state.durationSec > 0 ? (state.positionSec / state.durationSec) * 100 : 0;

  return (
    <div className="now-playing-bar">
      <div className="np-left">
        {t ? (
          <>
            <div className="np-art">
              <AlbumArt client={client} artId={t.artId} size={80} alt={t.albumTitle} />
            </div>
            <div className="np-meta">
              <div className="np-title">{t.title}</div>
              <div className="np-sub">
                {t.artistName} — {t.albumTitle}
              </div>
            </div>
          </>
        ) : (
          <div className="np-meta">
            <div className="np-sub">{state.error || "Nothing playing"}</div>
          </div>
        )}
      </div>
      <div className="np-centre">
        <div className="np-transport">
          <button type="button" className="np-btn" onClick={() => void player.previous()} aria-label="Previous">
            <SkipBack size={16} />
          </button>
          <button type="button" className="np-btn np-playpause" onClick={() => player.toggle()} aria-label="Play/Pause">
            {state.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="np-btn" onClick={() => void player.next()} aria-label="Next">
            <SkipForward size={16} />
          </button>
        </div>
        <div className="np-seek">
          <span className="np-time">{fmt(state.positionSec)}</span>
          <div
            className="np-seek-bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              player.seek(frac * state.durationSec);
            }}
          >
            <div className="np-seek-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="np-time">{fmt(state.durationSec)}</span>
        </div>
      </div>
      <div className="np-right" />
    </div>
  );
}
