import { ListPlus, Play, Shuffle } from "lucide-react";
import type { Track } from "../api/client";
import type { Player } from "../audio/player";

// Play / Shuffle / Add-to-queue for any set of tracks (album, artist, playlist,
// all tracks, liked tracks). Reused so every view offers the same actions.
export function PlayActions({
  player,
  tracks,
  size = "md",
}: {
  player: Player;
  tracks: Track[];
  size?: "sm" | "md";
}) {
  const disabled = tracks.length === 0;
  const s = size === "sm" ? "btn-sm" : "";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={`btn btn-primary gap-2 ${s}`} disabled={disabled} onClick={() => void player.playQueue(tracks)}>
        <Play size={16} /> Play
      </button>
      <button type="button" className={`btn gap-2 ${s}`} disabled={disabled} onClick={() => void player.playShuffled(tracks)}>
        <Shuffle size={15} /> Shuffle
      </button>
      <button
        type="button"
        className={`btn btn-ghost gap-2 ${s}`}
        disabled={disabled}
        onClick={() => player.addToQueue(tracks)}
        title="Add to the up-next queue"
      >
        <ListPlus size={16} /> Queue
      </button>
    </div>
  );
}
