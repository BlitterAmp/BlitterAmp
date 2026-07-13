/** Splits items into ordered rows, clamping invalid column counts to one. */
export function chunkIntoRows<T>(items: readonly T[], columns: number): T[][] {
  const rowSize = Math.max(1, Math.floor(columns));
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += rowSize) {
    rows.push(items.slice(index, index + rowSize));
  }
  return rows;
}

/** Matches the column count produced by CSS auto-fill minmax tracks. */
export function columnCountForWidth(width: number, minimumWidth: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minimumWidth + gap)));
}

/** Whole-pixel measurement settling: layout feedback wobbles rects by
 * sub-pixel amounts every pass, and a measurement that changes on every
 * observer fire re-renders forever ("maximum update depth exceeded" on
 * WebKitGTK). Returning the previous value for same-pixel measurements lets
 * React bail out of the update. */
export function settleMeasurement(previous: number, raw: number): number {
  const rounded = Math.round(raw);
  return previous === rounded ? previous : rounded;
}
