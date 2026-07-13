// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Album } from "../../api/client";
import { AlbumView } from "./AlbumView";

const album: Album = {
  albumId: "alb-1",
  title: "Metadata Album",
  primaryArtist: { artistId: "art-1", name: "Primary" },
  artistCredits: [
    { artistId: "art-1", name: "Primary", joinPhrase: " presents " },
    { artistId: "art-2", name: "Guest", joinPhrase: "" },
  ],
  trackCount: 0,
};

vi.mock("../../state/library", () => ({
  useLibrary: () => ({ albumById: new Map([[album.albumId, album]]), tracksByAlbum: new Map() }),
}));
vi.mock("../AlbumArt", () => ({ AlbumArt: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock("../PlayActions", () => ({ PlayActions: () => null }));
vi.mock("../TrackList", () => ({ TrackList: () => null }));

afterEach(cleanup);

describe("AlbumView", () => {
  it("renders albumById metadata without requiring a first track", () => {
    const onNavigate = vi.fn();
    render(<AlbumView client={{} as never} player={{} as never} albumId="alb-1" onNavigate={onNavigate} onBack={() => {}} />);

    expect(screen.getByRole("heading", { name: "Metadata Album" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guest" }).parentElement?.parentElement?.textContent).toBe("Primary presents Guest");
    fireEvent.click(screen.getByRole("button", { name: "Guest" }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-2" });
  });
});
