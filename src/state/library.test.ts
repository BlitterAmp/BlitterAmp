import { describe, expect, it } from "vitest";
import type { Track } from "../api/client";
import { groupTracksByCreditedArtist } from "./library";

describe("groupTracksByCreditedArtist", () => {
  it("includes guest appearances and deduplicates repeated artist credits", () => {
    const track = {
      trackId: "trk-1",
      artistCredits: [
        { artistId: "art-main", name: "Main", joinPhrase: " feat. " },
        { artistId: "art-guest", name: "Guest", joinPhrase: " & " },
        { artistId: "art-guest", name: "Guest", joinPhrase: "" },
      ],
    } as Track;

    const index = groupTracksByCreditedArtist([track]);
    expect(index.get("art-main")).toEqual([track]);
    expect(index.get("art-guest")).toEqual([track]);
  });
});
