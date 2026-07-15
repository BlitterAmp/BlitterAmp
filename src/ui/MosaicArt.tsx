import { AlbumArt } from "./AlbumArt";

// A playlist/mix cover: a 2×2 mash-up of the distinct album arts inside it,
// falling back to a single image (or a placeholder) when there aren't several.
export function MosaicArt({
  artIds,
  size = 300,
  alt = "",
  adaptive = false,
}: {
  artIds: readonly (string | null | undefined)[];
  size?: number;
  alt?: string;
  adaptive?: boolean;
}) {
  const distinct = Array.from(new Set(artIds.filter((a): a is string => !!a)));

  if (distinct.length <= 1) {
    return <AlbumArt artId={distinct[0]} size={size} alt={alt} />;
  }
  const count = adaptive && distinct.length >= 12 ? 12 : adaptive && distinct.length >= 9 ? 9 : 4;
  const tiles = Array.from({ length: count }, (_, i) => distinct[i % distinct.length]);
  const columns = count === 12 ? "grid-cols-4 grid-rows-3" : count === 9 ? "grid-cols-3 grid-rows-3" : "grid-cols-2 grid-rows-2";
  return (
    <div className={`grid size-full ${columns}`} role="img" aria-label={alt}>
      {tiles.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed mosaic cells
        <div key={i} className="min-h-0 min-w-0 overflow-hidden">
          <AlbumArt artId={id} size={Math.ceil(size / Math.sqrt(count))} alt="" />
        </div>
      ))}
    </div>
  );
}
