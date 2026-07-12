import type { Client } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
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

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Tracks</h1>
        <span className="text-sm opacity-60">{tracks.length}</span>
      </div>
      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} showAlbum />
    </section>
  );
}
