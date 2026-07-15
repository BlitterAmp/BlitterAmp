import type { Client } from "../../api/client";
import { useLibrary } from "../../state/library";
import { ArtistGrid } from "../ArtistGrid";

export function ArtistsView({ onOpen }: { client?: Client; onOpen: (artistId: string) => void }) {
  const { artists } = useLibrary();

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Artists</h1>
        <span className="text-sm opacity-60">{artists.length}</span>
      </div>

      <ArtistGrid artists={artists} onOpen={onOpen} />
    </section>
  );
}
