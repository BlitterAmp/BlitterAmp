import { describe, expect, it } from "vitest";
import type { Album, Track } from "../../api/client";
import { groupArtistTracks } from "./ArtistView";

function track(albumId: string, title: string, discNumber: number, index: number): Track {
  return { trackId: `${albumId}-${discNumber}-${index}`, albumId, albumTitle: albumId, title, discNumber, index } as Track;
}

describe("ArtistView track grouping", () => {
  it("groups albums in display order and tracks by disc then index", () => {
    const albums = [
      { albumId: "early", title: "Early Album", year: 2001 },
      { albumId: "late", title: "Late Album", year: 2009 },
    ] as Album[];
    const tracks = [
      track("late", "Second", 1, 2),
      track("early", "Disc Two", 2, 1),
      track("early", "Opening", 1, 1),
      track("late", "First", 1, 1),
    ];

    const groups = groupArtistTracks(albums, tracks);

    expect(groups.map((group) => group.title)).toEqual(["Early Album", "Late Album"]);
    expect(groups[0].tracks.map((item) => item.title)).toEqual(["Opening", "Disc Two"]);
    expect(groups[1].tracks.map((item) => item.title)).toEqual(["First", "Second"]);
  });
});
