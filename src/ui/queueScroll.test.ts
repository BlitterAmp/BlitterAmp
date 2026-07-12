import { describe, expect, it } from "vitest";
import type { Track } from "../api/client";
import { projectQueueScrollOffset } from "./queueScroll";

const track = (trackId: string) => ({ trackId }) as Track;

describe("projectQueueScrollOffset", () => {
  it("preserves the absolute queue position when the start index changes", () => {
    const queue = ["a", "b", "c", "d", "e"].map(track);
    expect(projectQueueScrollOffset(144, queue, 1, queue, 2, 400)).toBe(96);
    expect(projectQueueScrollOffset(48, queue, 2, queue, 1, 400)).toBe(96);
  });

  it("moves to the top when jumping to the currently viewed relative row", () => {
    const queue = Array.from({ length: 20 }, (_, index) => track(String(index)));
    expect(projectQueueScrollOffset(5 * 48, queue, 1, queue, 7, 400)).toBe(0);
  });

  it("anchors duplicate track IDs by occurrence across queue replacement", () => {
    const oldQueue = ["a", "dup", "b", "dup", "c", "d"].map(track);
    const newQueue = ["a", "x", "dup", "b", "dup", "c", "d"].map(track);
    // The second dup is the top row, with 12px scrolled into it.
    expect(projectQueueScrollOffset(2 * 48 + 12, oldQueue, 1, newQueue, 1, 96)).toBe(3 * 48 + 12);
  });

  it("clamps missing anchors and shortened queues without blank windows", () => {
    const oldQueue = Array.from({ length: 20 }, (_, index) => track(String(index)));
    const newQueue = [track("x"), track("y"), track("z")];
    expect(projectQueueScrollOffset(600, oldQueue, 1, newQueue, 1, 48)).toBe(48);
  });

  it("recovers at the top after clear and repopulate", () => {
    const queue = [track("a"), track("b")];
    expect(projectQueueScrollOffset(240, queue, 1, [], 0, 400)).toBe(0);
    expect(projectQueueScrollOffset(0, [], 0, queue, 0, 400)).toBe(0);
  });
});
