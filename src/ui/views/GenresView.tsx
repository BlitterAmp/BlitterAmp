import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import type { Album, Artist, Client, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibrary } from "../../state/library";
import { AlbumArt } from "../AlbumArt";
import { ArtistGrid } from "../ArtistGrid";
import { genreDisplayName } from "../genre";
import { MosaicArt } from "../MosaicArt";
import { PlayActions } from "../PlayActions";
import { TrackList, type NavTarget } from "../TrackList";
import { groupArtistTracks } from "./ArtistView";

export function genreArtIds(artists: readonly Artist[], albumsByArtist: ReadonlyMap<string, Album[]>): string[] {
  const albums = artists.map((artist) => albumsByArtist.get(artist.artistId) ?? []);
  const artIds: string[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...albums.map((items) => items.length));

  for (let index = 0; index < longest && artIds.length < 12; index++) {
    for (const artistAlbums of albums) {
      const artId = artistAlbums[index]?.artId;
      if (artId && !seen.has(artId)) {
        seen.add(artId);
        artIds.push(artId);
        if (artIds.length === 12) break;
      }
    }
  }
  return artIds;
}

export function genreLibraryItems(
  artists: readonly Artist[],
  albumsByArtist: ReadonlyMap<string, Album[]>,
  tracksByArtist: ReadonlyMap<string, Track[]>,
): { albums: Album[]; tracks: Track[] } {
  const albums = new Map<string, Album>();
  const tracks = new Map<string, Track>();
  for (const artist of artists) {
    for (const album of albumsByArtist.get(artist.artistId) ?? []) albums.set(album.albumId, album);
    for (const track of tracksByArtist.get(artist.artistId) ?? []) tracks.set(track.trackId, track);
  }
  return {
    albums: [...albums.values()].sort((a, b) =>
      a.primaryArtist.name.localeCompare(b.primaryArtist.name) ||
      (a.year ?? 0) - (b.year ?? 0) ||
      a.title.localeCompare(b.title)),
    tracks: [...tracks.values()],
  };
}

export function GenresView({ onOpen }: { onOpen: (genre: string) => void }) {
  const { genres, artistsByGenre, albumsByArtist } = useLibrary();

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Genres</h1>
        <span className="text-sm opacity-60">{genres.length}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(180px,100%),1fr))] gap-5">
        {genres.map((genre) => {
          const artists = artistsByGenre.get(genre) ?? [];
          const displayName = genreDisplayName(genre);
          return (
            <button key={genre} type="button" className="group min-w-0 text-left" onClick={() => onOpen(genre)}>
              <div className="aspect-square overflow-hidden rounded-box bg-base-300 shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                <MosaicArt artIds={genreArtIds(artists, albumsByArtist)} adaptive alt={displayName} />
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs opacity-60">{artists.length} {artists.length === 1 ? "artist" : "artists"}</div>
            </button>
          );
        })}
      </div>
      {genres.length === 0 && <p className="py-16 text-center text-sm opacity-60">No MusicBrainz genres yet.</p>}
    </section>
  );
}

export function GenreView({
  client,
  player,
  genre,
  onNavigate,
  onBack,
}: {
  client: Client;
  player: Player;
  genre: string;
  onNavigate: (target: NavTarget) => void;
  onBack: () => void;
}) {
  const { artistsByGenre, albumsByArtist, tracksByArtist } = useLibrary();
  const artists = artistsByGenre.get(genre) ?? [];
  const { albums, tracks } = useMemo(
    () => genreLibraryItems(artists, albumsByArtist, tracksByArtist),
    [artists, albumsByArtist, tracksByArtist],
  );
  const trackGroups = useMemo(() => groupArtistTracks(albums, tracks), [albums, tracks]);
  const orderedTracks = trackGroups.flatMap((group) => group.tracks);
  const displayName = genreDisplayName(genre);
  const artIds = genreArtIds(artists, albumsByArtist);

  return (
    <section>
      <button type="button" className="btn btn-ghost btn-sm mb-4 gap-1" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      <div className="mb-8 flex items-end gap-6">
        <div className="size-48 shrink-0 overflow-hidden rounded-box bg-base-300 shadow-lg">
          <MosaicArt artIds={artIds} adaptive size={600} alt={displayName} />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider opacity-50">Genre</div>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          <div className="mt-1 text-sm opacity-60">
            {artists.length} {artists.length === 1 ? "artist" : "artists"} · {albums.length} {albums.length === 1 ? "album" : "albums"} · {orderedTracks.length} {orderedTracks.length === 1 ? "track" : "tracks"}
          </div>
          <div className="mt-4">
            <PlayActions player={player} tracks={orderedTracks} />
          </div>
        </div>
      </div>

      {artists.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Artists</h2>
          <div className="mb-8">
            <ArtistGrid artists={artists} onOpen={(artistId) => onNavigate({ name: "artist", artistId })} />
          </div>
        </>
      )}

      {albums.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-5">
            {albums.map((album) => (
              <button key={album.albumId} type="button" className="group min-w-0 text-left" onClick={() => onNavigate({ name: "album", albumId: album.albumId })}>
                <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                  <AlbumArt artId={album.artId} alt={album.title} />
                </div>
                <div className="mt-2 truncate text-sm font-medium">{album.title}</div>
                <div className="truncate text-xs opacity-60">{album.primaryArtist.name}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {orderedTracks.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Tracks</h2>
          <TrackList client={client} player={player} tracks={orderedTracks} onNavigate={onNavigate} showAlbumHeaders />
        </>
      )}
      {artists.length === 0 && <p className="py-16 text-center text-sm opacity-60">No artists in this genre.</p>}
    </section>
  );
}
