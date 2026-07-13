import { useEffect, useState } from "react";
import type { Client, SearchResults } from "../../api/client";
import type { Player } from "../../audio/player";
import { AlbumArt } from "../AlbumArt";
import { ArtistCredits } from "../ArtistCredits";
import { TrackList, type NavTarget } from "../TrackList";

export function SearchView({
  client,
  player,
  query,
  onNavigate,
}: {
  client: Client;
  player: Player;
  query: string;
  onNavigate: (t: NavTarget) => void;
}) {
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      client
        .search(query.trim())
        .then((r) => live && setResults(r))
        .catch((err) => live && setError(err instanceof Error ? err.message : "Search failed."));
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [client, query]);

  if (query.trim().length < 2) {
    return <div className="opacity-60">Type at least two characters to search.</div>;
  }

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold">Results for “{query}”</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {results?.artists && results.artists.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Artists</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {results.artists.map((a) => (
              <button key={a.artistId} type="button" className="group text-center" onClick={() => onNavigate({ name: "artist", artistId: a.artistId })}>
                <div className="mx-auto aspect-square w-full overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                  <AlbumArt client={client} artId={a.artId} alt={a.name} />
                </div>
                <div className="mt-2 truncate text-sm font-medium">{a.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {results?.albums && results.albums.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {results.albums.map((a) => (
              <div key={a.albumId} className="group min-w-0 text-left">
                <button type="button" className="block w-full text-left" onClick={() => onNavigate({ name: "album", albumId: a.albumId })}>
                  <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                    <AlbumArt client={client} artId={a.artId} alt={a.title} />
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{a.title}</div>
                </button>
                <ArtistCredits credits={a.artistCredits} className="block max-w-full truncate text-xs opacity-60" onOpenArtist={(artistId) => onNavigate({ name: "artist", artistId })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {results?.tracks && results.tracks.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Tracks</h2>
          <TrackList client={client} player={player} tracks={results.tracks} onNavigate={onNavigate} showAlbum />
        </div>
      )}

      {results && !results.artists.length && !results.albums.length && !results.tracks.length && (
        <div className="opacity-60">Nothing found.</div>
      )}
    </section>
  );
}
