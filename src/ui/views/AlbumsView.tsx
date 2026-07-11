import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import type { Album, Client } from "../../api/client";
import { AlbumArt } from "../AlbumArt";
import { pickFolder } from "../Settings";
import { setEngineSource } from "../../state/engine";

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
    const path = await pickFolder();
    if (!path) return;
    setError("");
    setScanning(true);
    try {
      await setEngineSource(client.baseUrl, path);
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
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Albums</h1>
        <span className="text-sm opacity-60">{albums.length} loaded</span>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
        {albums.map((a) => (
          <button
            type="button"
            key={a.albumId}
            className="group text-left"
            onClick={() => onOpen(a.albumId)}
          >
            <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
              <AlbumArt client={client} artId={a.artId} alt={a.title} />
            </div>
            <div className="mt-2 truncate text-sm font-medium">{a.title}</div>
            <div className="truncate text-xs opacity-60">
              {a.artistName}
              {a.year ? ` · ${a.year}` : ""}
            </div>
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

      {albums.length === 0 && !error && (
        <div className="hero mt-10">
          <div className="hero-content text-center">
            <div className="max-w-md">
              {scanning ? (
                <p className="flex items-center justify-center gap-2">
                  <span className="loading loading-spinner loading-sm" /> Scanning your music…
                </p>
              ) : managed ? (
                <>
                  <p className="mb-4 opacity-70">Your library is empty. Point BlitterAmp at your music folder to get started.</p>
                  <div className="flex justify-center gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => void chooseFolder()}>
                      <FolderOpen size={16} /> Choose music folder
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={onManage}>
                      Settings
                    </button>
                  </div>
                </>
              ) : (
                <p className="opacity-70">No albums yet — point your BlitterServer at a music directory in its web admin.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
