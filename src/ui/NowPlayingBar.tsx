import { ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, LoveState } from "../api/client";
import type { Player, PlayerState } from "../audio/player";
import { AlbumArt } from "./AlbumArt";
import { ArtistCredits } from "./ArtistCredits";
import { LoveControl } from "./LoveControl";
import type { NavTarget } from "./TrackList";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlayingBar({
  client,
  player,
  queueOpen,
  onToggleQueue,
  onNavigate,
}: {
  client: Client;
  player: Player;
  queueOpen: boolean;
  onToggleQueue: () => void;
  onNavigate: (target: NavTarget) => void;
}) {
  const [s, setS] = useState<PlayerState>(player.currentState());
  const [love, setLove] = useState<LoveState>(s.track?.loveState ?? "neutral");
  const [loveError, setLoveError] = useState("");
  useEffect(() => player.subscribe(setS), [player]);

  const t = s.track;
  useEffect(() => {
    setLove(t?.loveState ?? "neutral");
    setLoveError("");
  }, [t?.trackId, t?.loveState]);

  async function updateLove(state: LoveState) {
    if (!t) return;
    const previous = love;
    setLove(state);
    setLoveError("");
    try {
      await client.setLove(t.trackId, state);
    } catch {
      setLove(previous);
      setLoveError("Could not update taste.");
    }
  }
  const progress = s.durationSec > 0 ? (s.positionSec / s.durationSec) * 100 : 0;

  return (
    <footer className="grid h-20 shrink-0 grid-cols-3 items-center gap-4 border-t border-base-300 bg-base-100 px-4">
      <div className="flex min-w-0 items-center gap-3">
        {t ? (
          <>
            <div className="size-12 overflow-hidden rounded-md">
              <AlbumArt artId={t.artId} size={96} alt={t.albumTitle} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              <div className="flex min-w-0 items-center text-xs opacity-60">
                <ArtistCredits credits={t.artistCredits} className="truncate" onOpenArtist={(artistId) => onNavigate({ name: "artist", artistId })} />
                <span className="shrink-0"> — </span>
                <button type="button" className="truncate hover:text-primary" onClick={() => onNavigate({ name: "album", albumId: t.albumId })}>{t.albumTitle}</button>
              </div>
            </div>
            <LoveControl state={love} onChange={(state) => void updateLove(state)} label={`Taste for ${t.title}`} />
            {loveError && <span role="alert" className="sr-only">{loveError}</span>}
          </>
        ) : (
          <div className="text-xs opacity-60">{s.error || "Nothing playing"}</div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`btn btn-ghost btn-xs btn-circle ${s.shuffle ? "text-primary" : "opacity-70"}`}
            onClick={() => player.toggleShuffle()}
            aria-label="Shuffle"
          >
            <Shuffle size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => void player.previous()} aria-label="Previous">
            <SkipBack size={16} />
          </button>
          <button type="button" className="btn btn-primary btn-sm btn-circle" onClick={() => player.toggle()} aria-label="Play/Pause">
            {s.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => void player.next()} aria-label="Next">
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-xs btn-circle ${s.repeat !== "off" ? "text-primary" : "opacity-70"}`}
            onClick={() => player.cycleRepeat()}
            aria-label="Repeat"
            title={`Repeat: ${s.repeat}`}
          >
            {s.repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>
        <div className="flex w-full max-w-md items-center gap-2 text-[11px] tabular-nums opacity-70">
          <span>{fmt(s.positionSec)}</span>
          <div
            className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-base-300"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              player.seek(((e.clientX - rect.left) / rect.width) * s.durationSec);
            }}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <span>{fmt(s.durationSec)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => player.setVolume(s.volume > 0 ? 0 : 1)} aria-label="Mute">
          {s.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={s.volume}
          onChange={(e) => player.setVolume(Number(e.target.value))}
          className="range range-xs w-24"
          aria-label="Volume"
        />
        <button
          type="button"
          className={`btn btn-ghost btn-sm btn-square ${queueOpen ? "text-primary" : ""}`}
          onClick={onToggleQueue}
          aria-label="Queue"
        >
          <ListMusic size={16} />
        </button>
      </div>
    </footer>
  );
}
