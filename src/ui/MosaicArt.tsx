import { AlbumArt } from "./AlbumArt";

// A playlist/mix cover: a 2×2 mash-up of the distinct album arts inside it,
// falling back to a single image (or a placeholder) when there aren't several.
export function MosaicArt({
  artIds,
  size = 300,
  alt = "",
}: {
  artIds: (string | null | undefined)[];
  size?: number;
  alt?: string;
}) {
  const distinct = Array.from(new Set(artIds.filter((a): a is string => !!a)));

  if (distinct.length <= 1) {
    return <AlbumArt artId={distinct[0]} size={size} alt={alt} />;
  }
  // Cycle to fill the 2×2 when there are 2–3 distinct covers.
  const four = Array.from({ length: 4 }, (_, i) => distinct[i % distinct.length]);
  return (
    <div className="grid size-full grid-cols-2 grid-rows-2">
      {four.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-cell mosaic
        <AlbumArt key={i} artId={id} size={Math.round(size / 2)} alt="" />
      ))}
    </div>
  );
}
