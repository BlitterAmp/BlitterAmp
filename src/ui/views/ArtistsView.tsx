import type { Client } from "../../api/client";
import { useLibrary } from "../../state/library";
import { AlbumArt } from "../AlbumArt";

export function ArtistsView({ onOpen }: { client?: Client; onOpen: (artistId: string) => void }) {
  const { artists } = useLibrary();

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Artists</h1>
        <span className="text-sm opacity-60">{artists.length}</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
        {artists.map((a) => (
          <button type="button" key={a.artistId} className="group text-center" onClick={() => onOpen(a.artistId)}>
            <div className="mx-auto aspect-square w-full overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
              <AlbumArt artId={a.artId} alt={a.name} />
            </div>
            <div className="mt-2 truncate text-sm font-medium">{a.name}</div>
            <div className="truncate text-xs opacity-60">{a.albumCount ?? 0} albums</div>
          </button>
        ))}
      </div>
    </section>
  );
}
