import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

import { parseSavedPlayerState } from "./playerSession";

describe("parseSavedPlayerState", () => {
  it("validates and clamps persisted playback state", () => {
    expect(parseSavedPlayerState({
      version: 1,
      queueTrackIds: ["a", "a"],
      orderedTrackIds: ["a", "a"],
      queueIndex: 1,
      positionSec: -2,
      volume: 4,
      shuffle: true,
      repeat: "one",
    })).toEqual({
      version: 1,
      queueTrackIds: ["a", "a"],
      orderedTrackIds: ["a", "a"],
      queueIndex: 1,
      positionSec: 0,
      volume: 1,
      shuffle: true,
      repeat: "one",
    });
  });

  it.each([
    null,
    {},
    { version: 2 },
    { version: 1, queueTrackIds: [4], orderedTrackIds: [], queueIndex: 0, positionSec: 0, volume: 1, shuffle: false, repeat: "off" },
    { version: 1, queueTrackIds: [], orderedTrackIds: [], queueIndex: 0, positionSec: Number.NaN, volume: 1, shuffle: false, repeat: "off" },
  ])("rejects malformed state", (value) => {
    expect(parseSavedPlayerState(value)).toBeNull();
  });
});
