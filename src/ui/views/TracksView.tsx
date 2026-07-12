import { useMemo, useState } from "react";
import type { Client } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
import { PlayActions } from "../PlayActions";
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
  const { tracks } = useLibrary();
  const [likedOnly, setLikedOnly] = useState(false);
  const shown = useMemo(
    () => (likedOnly ? tracks.filter((t) => t.loveState === "loved") : tracks),
    [tracks, likedOnly],
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Tracks</h1>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={likedOnly}
              onChange={(e) => setLikedOnly(e.target.checked)}
            />
            Liked only
          </label>
        </div>
        <span className="text-sm opacity-60">{shown.length}</span>
      </div>
      <div className="mb-4">
        <PlayActions player={player} tracks={shown} />
      </div>
      <TrackList client={client} player={player} tracks={shown} onNavigate={onNavigate} showAlbum showArtwork />
    </section>
  );
}
