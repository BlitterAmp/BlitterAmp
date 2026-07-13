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
