import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import type { Client } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
import { AlbumArt } from "../AlbumArt";
import { ArtistCredits } from "../ArtistCredits";
import { PlayActions } from "../PlayActions";
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
  const { albumById, tracksByAlbum } = useLibrary();
  const album = albumById.get(albumId);
  const tracks = useMemo(() => {
    const list = [...(tracksByAlbum.get(albumId) ?? [])];
    list.sort((a, b) => (a.discNumber ?? 0) - (b.discNumber ?? 0) || (a.index ?? 0) - (b.index ?? 0));
    return list;
  }, [tracksByAlbum, albumId]);

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      {album && (
        <div className="mb-6 flex gap-6">
          <div className="size-48 shrink-0 overflow-hidden rounded-box shadow-lg">
            <AlbumArt artId={album.artId} size={600} alt={album.title} />
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-xs uppercase tracking-wider opacity-50">Album</div>
            <h1 className="text-3xl font-bold">{album.title}</h1>
            <ArtistCredits
              credits={album.artistCredits}
              className="mt-1 w-fit text-left opacity-70"
              onOpenArtist={(artistId) => onNavigate({ name: "artist", artistId })}
            />
            <div className="mt-4">
              <PlayActions player={player} tracks={tracks} />
            </div>
          </div>
        </div>
      )}

      <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} />
    </section>
  );
}
