import { describe, expect, it } from "vitest";
import { chunkIntoRows, columnCountForWidth } from "./virtualGrid";

describe("chunkIntoRows", () => {
  it.each([
    { items: [] as number[], columns: 3, expected: [] },
    { items: [1, 2, 3], columns: 3, expected: [[1, 2, 3]] },
    { items: [1, 2, 3, 4, 5], columns: 2, expected: [[1, 2], [3, 4], [5]] },
    { items: [1, 2, 3], columns: 0, expected: [[1], [2], [3]] },
  ])("chunks $items into rows of $columns columns", ({ items, columns, expected }) => {
    expect(chunkIntoRows(items, columns)).toEqual(expected);
  });

  it("does not mutate the input", () => {
    const items = [1, 2, 3];

    chunkIntoRows(items, 2);

    expect(items).toEqual([1, 2, 3]);
  });
});

describe("columnCountForWidth", () => {
  it.each([
    { width: 0, minimumWidth: 160, gap: 20, expected: 1 },
    { width: 159, minimumWidth: 160, gap: 20, expected: 1 },
    { width: 160, minimumWidth: 160, gap: 20, expected: 1 },
    { width: 339, minimumWidth: 160, gap: 20, expected: 1 },
    { width: 340, minimumWidth: 160, gap: 20, expected: 2 },
    { width: 700, minimumWidth: 160, gap: 20, expected: 4 },
  ])("returns $expected columns for a $width px container", ({ width, minimumWidth, gap, expected }) => {
    expect(columnCountForWidth(width, minimumWidth, gap)).toBe(expected);
  });
});
