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
    <footer className="grid h-20 shrink-0 grid-cols-3 items-center gap-4 border-t border-base-300 bg-base-100 px-4">
      <div className="flex min-w-0 items-center gap-3">
        {t ? (
          <>
            <div className="size-12 overflow-hidden rounded-md">
              <AlbumArt client={client} artId={t.artId} size={96} alt={t.albumTitle} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              <div className="truncate text-xs opacity-60">
                {t.artistName} — {t.albumTitle}
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs opacity-60">{state.error || "Nothing playing"}</div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => void player.previous()} aria-label="Previous">
            <SkipBack size={16} />
          </button>
          <button type="button" className="btn btn-primary btn-sm btn-circle" onClick={() => player.toggle()} aria-label="Play/Pause">
            {state.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => void player.next()} aria-label="Next">
            <SkipForward size={16} />
          </button>
        </div>
        <div className="flex w-full max-w-md items-center gap-2 text-[11px] tabular-nums opacity-70">
          <span>{fmt(state.positionSec)}</span>
          <div
            className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-base-300"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              player.seek(((e.clientX - rect.left) / rect.width) * state.durationSec);
            }}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <span>{fmt(state.durationSec)}</span>
        </div>
      </div>

      <div />
    </footer>
  );
}
