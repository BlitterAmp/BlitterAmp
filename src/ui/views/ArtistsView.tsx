import { useEffect, useState } from "react";
import type { Artist, Client } from "../../api/client";
import { AlbumArt } from "../AlbumArt";

export function ArtistsView({ client }: { client: Client }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  async function loadMore(from?: string) {
    try {
      const page = await client.artists(from);
      setArtists((prev) => (from ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load artists.");
    }
  }

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Artists</h1>
        <span className="text-sm opacity-60">{artists.length} loaded</span>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        {artists.map((a) => (
          <div key={a.artistId} className="text-center">
            <div className="mx-auto aspect-square w-full overflow-hidden rounded-full shadow-sm">
              <AlbumArt client={client} artId={a.artId} alt={a.name} />
            </div>
            <div className="mt-2 truncate text-sm font-medium">{a.name}</div>
            <div className="truncate text-xs opacity-60">{a.albumCount ?? 0} albums</div>
          </div>
        ))}
      </div>

      {cursor && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn btn-sm" onClick={() => void loadMore(cursor)}>
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
