import { describe, expect, it } from "vitest";
import type { Track } from "../api/client";
import { spreadByArtist } from "./shuffle";

function t(id: string, artistId: string): Track {
  return { trackId: id, primaryArtist: { artistId, name: artistId }, artistCredits: [{ artistId, name: artistId, joinPhrase: "" }] } as Track;
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
    const out = spreadByArtist(tracks, () => 0);
    expect(out).toHaveLength(6);
    let adjacent = 0;
    for (let i = 1; i < out.length; i++) if (out[i].primaryArtist.artistId === out[i - 1].primaryArtist.artistId) adjacent++;
    // A=3 of 6 can be fully separated, so zero repeats.
    expect(adjacent).toBe(0);
    // Same multiset of tracks, nothing dropped.
    expect(new Set(out.map((x) => x.trackId))).toEqual(new Set(["1", "2", "3", "4", "5", "6"]));
  });

  it("groups by primary artist rather than a guest credit", () => {
    const tracks = [t("1", "A"), t("2", "A"), t("3", "B")];
    tracks[0].artistCredits.push({ artistId: "B", name: "Guest B", joinPhrase: "" });
    const out = spreadByArtist(tracks, () => 0);
    expect(out[0].trackId).toBe("1");
    expect(out.map((track) => track.primaryArtist.artistId)).toEqual(["A", "B", "A"]);
  });

  it("keeps everything even when one artist dominates", () => {
    const tracks = [t("1", "A"), t("2", "A"), t("3", "A"), t("4", "A"), t("5", "B")];
    const out = spreadByArtist(tracks);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((x) => x.trackId)).size).toBe(5);
  });

  it("produces different valid permutations instead of deterministic artist buckets", () => {
    const tracks = [t("a1", "A"), t("a2", "A"), t("b1", "B"), t("b2", "B"), t("c1", "C"), t("c2", "C")];
    const low = spreadByArtist(tracks, () => 0);
    const high = spreadByArtist(tracks, () => 0.999999);

    expect(low.map((track) => track.trackId)).not.toEqual(high.map((track) => track.trackId));
    for (const order of [low, high]) {
      for (let i = 1; i < order.length; i++) {
        expect(order[i].primaryArtist.artistId).not.toBe(order[i - 1].primaryArtist.artistId);
      }
    }
  });

  it("distributes each artist across the full queue", () => {
    const tracks = [
      t("a1", "A"), t("a2", "A"), t("a3", "A"), t("a4", "A"),
      t("b1", "B"), t("b2", "B"), t("b3", "B"), t("b4", "B"),
      t("c1", "C"), t("c2", "C"), t("c3", "C"), t("c4", "C"),
    ];
    const out = spreadByArtist(tracks, () => 0.4);

    for (const artistId of ["A", "B", "C"]) {
      const positions = out.flatMap((track, index) => track.primaryArtist.artistId === artistId ? [index] : []);
      expect(positions[positions.length - 1] - positions[0]).toBeGreaterThanOrEqual(8);
    }
  });

  it("handles a full-library-sized selection", () => {
    const tracks = Array.from({ length: 10_000 }, (_, index) => t(String(index), `artist-${index % 100}`));
    const out = spreadByArtist(tracks, () => 0.37);

    expect(out).toHaveLength(tracks.length);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].primaryArtist.artistId).not.toBe(out[i - 1].primaryArtist.artistId);
    }
  });
});
