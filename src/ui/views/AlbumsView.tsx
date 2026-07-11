import { useEffect, useState } from "react";
import type { Album, Client } from "../../api/client";
import { AlbumArt } from "../AlbumArt";

export function AlbumsView({ client, onOpen }: { client: Client; onOpen: (albumId: string) => void }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  async function loadMore(from?: string) {
    try {
      const page = await client.albums(from);
      setAlbums((prev) => (from ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load albums.");
    }
  }

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return (
    <div className="browse-section">
      <div className="browse-header">
        <div className="browse-title">Albums</div>
        <div className="browse-sub">{albums.length} loaded</div>
      </div>
      {error && <div className="signin-error">{error}</div>}
      <div className="browse-grid">
        {albums.map((a) => (
          <button type="button" key={a.albumId} className="grid-card" onClick={() => onOpen(a.albumId)}>
            <div className="grid-card-artwrap">
              <AlbumArt client={client} artId={a.artId} alt={a.title} />
            </div>
            <div className="grid-card-title">{a.title}</div>
            <div className="grid-card-sub">
              {a.artistName}
              {a.year ? ` · ${a.year}` : ""}
            </div>
          </button>
        ))}
      </div>
      {cursor && (
        <button type="button" className="signin-btn" onClick={() => void loadMore(cursor)}>
          Load more
        </button>
      )}
      {albums.length === 0 && !error && (
        <div className="content-placeholder">
          No albums yet — point your BlitterServer at a music directory in its web admin.
        </div>
      )}
    </div>
  );
}
