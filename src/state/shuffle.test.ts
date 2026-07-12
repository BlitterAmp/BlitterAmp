import { describe, expect, it } from "vitest";
import type { Track } from "../api/client";
import { spreadByArtist } from "./shuffle";

function t(id: string, artistId: string): Track {
  return { trackId: id, artistId } as Track;
}

describe("spreadByArtist", () => {
  it("does not place the same artist back-to-back when it can be avoided", () => {
    const tracks = [
      t("1", "A"),
      t("2", "A"),
      t("3", "A"),
      t("4", "B"),
      t("5", "B"),
      t("6", "C"),
    ];
    const out = spreadByArtist(tracks);
    expect(out).toHaveLength(6);
    let adjacent = 0;
    for (let i = 1; i < out.length; i++) if (out[i].artistId === out[i - 1].artistId) adjacent++;
    // A=3 of 6 can be fully separated, so zero repeats.
    expect(adjacent).toBe(0);
    // Same multiset of tracks, nothing dropped.
    expect(new Set(out.map((x) => x.trackId))).toEqual(new Set(["1", "2", "3", "4", "5", "6"]));
  });

  it("keeps everything even when one artist dominates", () => {
    const tracks = [t("1", "A"), t("2", "A"), t("3", "A"), t("4", "A"), t("5", "B")];
    const out = spreadByArtist(tracks);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((x) => x.trackId)).size).toBe(5);
  });
});
