import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ArtistDetail, Client } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
import { AlbumArt } from "../AlbumArt";
import { LoveControl } from "../LoveControl";
import { PlayActions } from "../PlayActions";
import { TrackList, type NavTarget } from "../TrackList";

export function ArtistView({
  client,
  player,
  artistId,
  onNavigate,
  onBack,
}: {
  client: Client;
  player: Player;
  artistId: string;
  onNavigate: (t: NavTarget) => void;
  onBack: () => void;
}) {
  const { albumsByArtist, artistById, tracksByArtist } = useLibrary();
  const albums = useMemo(() => {
    const list = [...(albumsByArtist.get(artistId) ?? [])];
    list.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    return list;
  }, [albumsByArtist, artistId]);
  const tracks = tracksByArtist.get(artistId) ?? [];

  // Bio/stats aren't in the cached list shape — fetch the detail on open.
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loveError, setLoveError] = useState("");
  useEffect(() => {
    setArtist(null);
    client
      .artist(artistId)
      .then(setArtist)
      .catch(() => {});
  }, [client, artistId]);

  const name = artist?.name ?? artistById.get(artistId)?.name ?? "";
  const artId = artist?.artId ?? albums[0]?.artId ?? tracks[0]?.artId;

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="mb-6 flex items-end gap-6">
        <div className="size-40 shrink-0 overflow-hidden rounded-box shadow-lg">
          <AlbumArt artId={artId} size={480} alt={name} />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider opacity-50">Artist</div>
          <h1 className="text-3xl font-bold">{name}</h1>
          {artist?.genres && artist.genres.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {artist.genres.map((g) => (
                <span key={g} className="badge badge-ghost badge-sm">
                  {g}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <PlayActions player={player} tracks={tracks} size="sm" />
            {artist && (
              <LoveControl
                state={artist.loveState}
                size={18}
                label={`Taste for ${artist.name}`}
                onChange={(state) => {
                  const previous = artist.loveState;
                  setArtist({ ...artist, loveState: state });
                  setLoveError("");
                  void client.setLove(artist.artistId, state).catch(() => {
                    setArtist((current) => current ? { ...current, loveState: previous } : current);
                    setLoveError("Could not update artist taste.");
                  });
                }}
              />
            )}
          </div>
          {loveError && <div role="alert" className="mt-2 text-xs text-error">{loveError}</div>}
          {artist?.bio && <p className="mt-3 line-clamp-3 max-w-2xl text-sm opacity-70">{artist.bio}</p>}
        </div>
      </div>

      {albums.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
            {albums.map((a) => (
              <button
                type="button"
                key={a.albumId}
                className="group text-left"
                onClick={() => onNavigate({ name: "album", albumId: a.albumId })}
              >
                <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                  <AlbumArt artId={a.artId} alt={a.title} />
                </div>
                <div className="mt-2 truncate text-sm font-medium">{a.title}</div>
                <div className="truncate text-xs opacity-60">{a.year ?? ""}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {tracks.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Tracks</h2>
          <TrackList client={client} player={player} tracks={tracks} onNavigate={onNavigate} showAlbum />
        </>
      )}
    </section>
  );
}
