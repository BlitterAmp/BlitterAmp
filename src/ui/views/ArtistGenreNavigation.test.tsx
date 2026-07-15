// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Artist } from "../../api/client";

const cachedArtist = { artistId: "artist-1", name: "Artist One", genres: ["electronica", "ambient"] } as Artist;
vi.mock("../../state/library", () => ({
  useLibrary: () => ({
    albumsByArtist: new Map(),
    artistById: new Map([[cachedArtist.artistId, cachedArtist]]),
    tracksByArtist: new Map(),
  }),
}));
vi.mock("../AlbumArt", () => ({ AlbumArt: () => <span /> }));
vi.mock("../PlayActions", () => ({ PlayActions: () => <span /> }));
vi.mock("../TrackList", () => ({ TrackList: () => <span /> }));

import { ArtistView } from "./ArtistView";

afterEach(cleanup);

describe("Artist genre navigation", () => {
  it("uses cached tags and opens their genre", () => {
    const onNavigate = vi.fn();
    const client = { artist: vi.fn(() => new Promise(() => {})) };

    render(<ArtistView client={client as never} player={{} as never} artistId="artist-1" onNavigate={onNavigate} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Electronica" }));

    expect(onNavigate).toHaveBeenCalledWith({ name: "genre", genre: "electronica" });
  });
});
