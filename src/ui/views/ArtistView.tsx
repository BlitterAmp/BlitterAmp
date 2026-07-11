import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Album, ArtistDetail, Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { AlbumArt } from "../AlbumArt";
import { StarRating } from "../StarRating";
import { LoveButton } from "../LoveButton";
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
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setArtist(null);
    Promise.all([client.artist(artistId), client.artistAlbums(artistId), client.artistTracks(artistId)])
      .then(([a, al, tr]) => {
        setArtist(a);
        setAlbums(al);
        setTracks(tr);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the artist."));
  }, [client, artistId]);

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      {artist && (
        <div className="mb-6 flex items-end gap-6">
          <div className="size-40 shrink-0 overflow-hidden rounded-full shadow-lg">
            <AlbumArt client={client} artId={artist.artId} size={480} alt={artist.name} />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider opacity-50">Artist</div>
            <h1 className="text-3xl font-bold">{artist.name}</h1>
            {artist.genres && artist.genres.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {artist.genres.map((g) => (
                  <span key={g} className="badge badge-ghost badge-sm">{g}</span>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn btn-primary btn-sm gap-2" onClick={() => void player.playQueue(tracks)}>
                <Play size={16} /> Play
              </button>
              <button
                type="button"
                className="btn btn-sm gap-2"
                onClick={() => {
                  player.toggleShuffle();
                  void player.playQueue(tracks);
                }}
              >
                <Shuffle size={15} /> Shuffle
              </button>
              <LoveButton
                state={artist.loveState}
                size={18}
                onChange={(s) => void client.setLove(artist.artistId, s).catch(() => {})}
              />
              <StarRating
                rating10={artist.userRating10 ?? 0}
                size={16}
                onChange={(r) => void client.setRating("artist", artist.artistId, r || null).catch(() => {})}
              />
            </div>
            {artist.bio && <p className="mt-3 line-clamp-3 max-w-2xl text-sm opacity-70">{artist.bio}</p>}
          </div>
        </div>
      )}

      {albums.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
            {albums.map((a) => (
              <button type="button" key={a.albumId} className="group text-left" onClick={() => onNavigate({ name: "album", albumId: a.albumId })}>
                <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                  <AlbumArt client={client} artId={a.artId} alt={a.title} />
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
