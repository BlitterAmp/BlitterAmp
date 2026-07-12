import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { useMemo } from "react";
import type { Client } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
import { AlbumArt } from "../AlbumArt";
import { TrackList, type NavTarget } from "../TrackList";

export function AlbumView({
  client,
  player,
  albumId,
  onNavigate,
  onBack,
}: {
  client: Client;
  player: Player;
  albumId: string;
  onNavigate: (t: NavTarget) => void;
  onBack: () => void;
}) {
  const { tracksByAlbum } = useLibrary();
  const tracks = useMemo(() => {
    const list = [...(tracksByAlbum.get(albumId) ?? [])];
    list.sort((a, b) => (a.discNumber ?? 0) - (b.discNumber ?? 0) || (a.index ?? 0) - (b.index ?? 0));
    return list;
  }, [tracksByAlbum, albumId]);

  const first = tracks[0];

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {first && (
        <div className="mb-6 flex gap-6">
          <div className="size-48 shrink-0 overflow-hidden rounded-box shadow-lg">
            <AlbumArt artId={first.artId} size={600} alt={first.albumTitle} />
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-xs uppercase tracking-wider opacity-50">Album</div>
            <h1 className="text-3xl font-bold">{first.albumTitle}</h1>
            <button
              type="button"
              className="mt-1 w-fit text-left opacity-70 hover:text-primary hover:underline"
              onClick={() => onNavigate({ name: "artist", artistId: first.artistId })}
            >
              {first.artistName}
            </button>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" className="btn btn-primary gap-2" onClick={() => void player.playQueue(tracks)}>
                <Play size={16} /> Play
              </button>
              <button
                type="button"
                className="btn gap-2"
                onClick={() => {
                  player.toggleShuffle();
                  void player.playQueue(tracks);
                }}
              >
                <Shuffle size={15} /> Shuffle
              </button>
            </div>
          </div>
        </div>
      )}

      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} />
    </section>
  );
}
