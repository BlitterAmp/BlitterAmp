import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import type { Album, Client } from "../../api/client";
import { setEngineSource } from "../../state/engine";
import { AlbumArt } from "../AlbumArt";

export function AlbumsView({
  client,
  managed,
  onOpen,
  onManage,
}: {
  client: Client;
  managed: boolean;
  onOpen: (albumId: string) => void;
  onManage: () => void;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  async function loadMore(from?: string) {
    try {
      const page = await client.albums(from);
      setAlbums((prev) => (from ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load albums.");
    }
  }

  async function chooseFolder() {
    const path = await open({ directory: true, multiple: false, title: "Choose your music folder" });
    if (typeof path !== "string") return;
    setError("");
    setScanning(true);
    try {
      await setEngineSource(client.baseUrl, path);
      // Poll the library until the scan surfaces albums (or a while passes).
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 750));
        const page = await client.albums();
        if (page.items.length > 0) {
          setAlbums(page.items);
          setCursor(page.nextCursor ?? null);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the music folder.");
    } finally {
      setScanning(false);
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
          {scanning ? (
            <>
              <span className="ba-spinner" /> Scanning your music…
            </>
          ) : managed ? (
            <>
              <p>Your library is empty. Point BlitterAmp at your music folder to get started.</p>
              <button type="button" className="signin-btn" onClick={() => void chooseFolder()}>
                <FolderOpen size={16} /> Choose music folder
              </button>
              <button type="button" className="signin-btn" onClick={onManage} style={{ marginTop: 8 }}>
                Open settings
              </button>
            </>
          ) : (
            <p>No albums yet — point your BlitterServer at a music directory in its web admin.</p>
          )}
        </div>
      )}
    </div>
  );
}
