// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Album, Artist, Track } from "../../api/client";

const artists = [
  { artistId: "one", name: "One" },
  { artistId: "two", name: "Two" },
] as Artist[];
const library = vi.hoisted(() => ({
  genres: ["electronica"],
  artistsByGenre: new Map<string, Artist[]>(),
  albumsByArtist: new Map<string, Album[]>(),
  tracksByArtist: new Map<string, Track[]>(),
}));

vi.mock("../../state/library", () => ({ useLibrary: () => library }));
vi.mock("../MosaicArt", () => ({ MosaicArt: ({ artIds, alt }: { artIds: string[]; alt: string }) => <span data-testid="mosaic">{alt}:{artIds.join(",")}</span> }));
vi.mock("../ArtistGrid", () => ({ ArtistGrid: ({ artists: items, onOpen }: { artists: Artist[]; onOpen: (id: string) => void }) => <div>{items.map((artist) => <button key={artist.artistId} type="button" onClick={() => onOpen(artist.artistId)}>{artist.name}</button>)}</div> }));
vi.mock("../AlbumArt", () => ({ AlbumArt: ({ alt }: { alt: string }) => <span>{alt} art</span> }));
vi.mock("../PlayActions", () => ({ PlayActions: ({ tracks }: { tracks: Track[] }) => <span data-testid="play-actions">{tracks.map((track) => track.trackId).join(",")}</span> }));
vi.mock("../TrackList", () => ({ TrackList: ({ tracks }: { tracks: Track[] }) => <span data-testid="track-list">{tracks.map((track) => track.trackId).join(",")}</span> }));

import { genreArtIds, GenresView, GenreView } from "./GenresView";

afterEach(cleanup);

describe("Genres views", () => {
  it("shows artist collections with round-robin album mosaics", () => {
    library.artistsByGenre = new Map([["electronica", artists]]);
    library.albumsByArtist = new Map([
      ["one", [{ albumId: "1a", artId: "art-1a" }, { albumId: "1b", artId: "art-1b" }] as Album[]],
      ["two", [{ albumId: "2a", artId: "art-2a" }] as Album[]],
    ]);
    const onOpen = vi.fn();

    render(<GenresView onOpen={onOpen} />);

    expect(screen.getByTestId("mosaic").textContent).toBe("Electronica:art-1a,art-2a,art-1b");
    expect(screen.getByText("2 artists")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Electronica/ }));
    expect(onOpen).toHaveBeenCalledWith("electronica");
  });

  it("shows playable artists, albums, and deduplicated album-grouped tracks", () => {
    const albumOne = { albumId: "album-1", title: "First Album", year: 2001, primaryArtist: { artistId: "one", name: "One" } } as Album;
    const albumTwo = { albumId: "album-2", title: "Second Album", year: 2002, primaryArtist: { artistId: "two", name: "Two" } } as Album;
    const shared = { trackId: "shared", albumId: "album-1", albumTitle: "First Album", title: "Shared", discNumber: 1, index: 1 } as Track;
    const second = { trackId: "second", albumId: "album-2", albumTitle: "Second Album", title: "Second", discNumber: 1, index: 1 } as Track;
    library.artistsByGenre = new Map([["electronica", artists]]);
    library.albumsByArtist = new Map([["one", [albumOne]], ["two", [albumTwo]]]);
    library.tracksByArtist = new Map([["one", [shared]], ["two", [shared, second]]]);
    const onNavigate = vi.fn();
    const setLove = vi.fn(async () => ({}));
    const client = { loves: vi.fn(async () => ({ items: [] })), setLove };

    render(<GenreView client={client as never} player={{} as never} genre="electronica" onNavigate={onNavigate} onBack={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "two" });
    fireEvent.click(screen.getByRole("button", { name: /Second Album art/ }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "album", albumId: "album-2" });
    expect(screen.getByTestId("play-actions").textContent).toBe("shared,second");
    expect(screen.getByTestId("track-list").textContent).toBe("shared,second");
    expect(screen.getByText("2 artists · 2 albums · 2 tracks")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    expect(setLove).toHaveBeenCalledWith("genre:electronica", "loved");
  });

  it("deduplicates art and caps mosaics at twelve covers", () => {
    const manyArtists = Array.from({ length: 13 }, (_, index) => ({ artistId: String(index) })) as Artist[];
    const albums = new Map(manyArtists.map((artist, index) => [artist.artistId, [{ albumId: String(index), artId: index === 12 ? "art-0" : `art-${index}` } as Album]]));
    expect(genreArtIds(manyArtists, albums)).toHaveLength(12);
  });
});
