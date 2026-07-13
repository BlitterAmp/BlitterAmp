import { describe, expect, it } from "vitest";
import { chunkIntoRows, columnCountForWidth, settleMeasurement } from "./virtualGrid";

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

describe("settleMeasurement", () => {
  it("absorbs sub-pixel wobble so feedback loops settle", () => {
    let value = settleMeasurement(0, 640.1);
    expect(value).toBe(640);
    // Wobbling raw measurements from repeated observer fires must be
    // identity-stable once rounded, or React re-renders indefinitely.
    for (const raw of [640.4, 640.1, 640.4, 639.8, 640.2]) {
      const next = settleMeasurement(value, raw);
      expect(next).toBe(value);
      value = next;
    }
  });

  it("moves on real changes", () => {
    expect(settleMeasurement(640, 320.2)).toBe(320);
  });
});
