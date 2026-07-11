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
    <div className="browse-section">
      <div className="browse-header">
        <div className="browse-title">Artists</div>
        <div className="browse-sub">{artists.length} loaded</div>
      </div>
      {error && <div className="signin-error">{error}</div>}
      <div className="browse-grid">
        {artists.map((a) => (
          <div key={a.artistId} className="grid-card">
            <div className="grid-card-artwrap grid-card-artwrap--round">
              <AlbumArt client={client} artId={a.artId} alt={a.name} />
            </div>
            <div className="grid-card-title">{a.name}</div>
            <div className="grid-card-sub">{a.albumCount ?? 0} albums</div>
          </div>
        ))}
      </div>
      {cursor && (
        <button type="button" className="signin-btn" onClick={() => void loadMore(cursor)}>
          Load more
        </button>
      )}
    </div>
  );
}
