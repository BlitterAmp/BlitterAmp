import { useEffect, useState } from "react";
import type { Artist, Client } from "../../api/client";
import { AlbumArt } from "../AlbumArt";
import { useLibraryVersion } from "../../state/useLibrarySync";

export function ArtistsView({ client, onOpen }: { client: Client; onOpen: (artistId: string) => void }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const libVersion = useLibraryVersion(client);

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
  }, [client, libVersion]);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Artists</h1>
        <span className="text-sm opacity-60">{artists.length} loaded</span>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        {artists.map((a) => (
          <button type="button" key={a.artistId} className="group text-center" onClick={() => onOpen(a.artistId)}>
            <div className="mx-auto aspect-square w-full overflow-hidden rounded-full shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
              <AlbumArt client={client} artId={a.artId} alt={a.name} />
            </div>
            <div className="mt-2 truncate text-sm font-medium">{a.name}</div>
            <div className="truncate text-xs opacity-60">{a.albumCount ?? 0} albums</div>
          </button>
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
