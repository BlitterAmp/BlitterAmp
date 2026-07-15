import type { Artist } from "../api/client";
import { AlbumArt } from "./AlbumArt";
import { VirtualizedGrid } from "./VirtualizedGrid";

export function ArtistGrid({ artists, onOpen }: { artists: readonly Artist[]; onOpen: (artistId: string) => void }) {
  return (
    <VirtualizedGrid
      items={artists}
      minimumItemWidth={150}
      gap={20}
      estimatedCaptionHeight={44}
      gridClassName="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-5"
      getItemKey={(artist) => artist.artistId}
      renderItem={(artist) => (
        <button key={artist.artistId} type="button" className="group min-w-0 text-center" onClick={() => onOpen(artist.artistId)}>
          <div className="mx-auto aspect-square w-full overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
            <AlbumArt artId={artist.artId} alt={artist.name} />
          </div>
          <div className="mt-2 truncate text-sm font-medium">{artist.name}</div>
          <div className="truncate text-xs opacity-60">{artist.albumCount ?? 0} albums</div>
        </button>
      )}
    />
  );
}
