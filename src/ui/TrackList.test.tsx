// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client, Track } from "../api/client";
import { ScrollContext } from "./ScrollContext";
import { TrackList } from "./TrackList";

const library = vi.hoisted(() => ({ albumById: new Map<string, { title?: string; year?: number | null; artId?: string | null }>() }));

vi.mock("./AlbumArt", () => ({ AlbumArt: ({ artId }: { artId?: string }) => <span data-testid="track-art">{artId}</span> }));
vi.mock("./PromptProvider", () => ({ usePrompt: () => vi.fn() }));
vi.mock("../state/playlists", () => ({ usePlaylists: () => ({ playlists: [], create: vi.fn(), append: vi.fn() }) }));
vi.mock("../state/library", () => ({ useLibrary: () => library }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 56 })),
  }),
}));

afterEach(() => {
  cleanup();
  library.albumById.clear();
});

describe("TrackList", () => {
  it("shows artwork instead of numbering and navigates from the artist name", () => {
    const track = { trackId: "trk-1", title: "Song", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [{ artistId: "art-1", name: "Artist", joinPhrase: " feat. " }, { artistId: "art-2", name: "Guest", joinPhrase: "" }], albumId: "alb-1", albumTitle: "Album", artId: "cover-1", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } } as Track;
    const onNavigate = vi.fn();
    const playQueue = vi.fn();
    const player = { canPlay: () => true, playQueue } as never;
    render(
      <ScrollContext.Provider value={null}>
        <TrackList client={{ setLove: vi.fn() } as unknown as Client} player={player} tracks={[track]} onNavigate={onNavigate} showAlbum showArtwork />
      </ScrollContext.Provider>,
    );

    expect(screen.getByTestId("track-art").textContent).toBe("cover-1");
    expect(screen.queryByText("1")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Artist" })[0]);
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-1" });
    fireEvent.click(screen.getAllByRole("button", { name: "Guest" })[0]);
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-2" });
    expect(screen.getByText("feat.")).toBeTruthy();
    expect(playQueue).not.toHaveBeenCalled();
  });

  it("falls back to current album artwork when cached track art is absent", () => {
    library.albumById.set("alb-1", { artId: "album-cover" });
    const track = { trackId: "trk-1", title: "Song", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [], albumId: "alb-1", albumTitle: "Album", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } } as Track;
    render(
      <ScrollContext.Provider value={null}>
        <TrackList client={{ setLove: vi.fn() } as unknown as Client} player={{ canPlay: () => true } as never} tracks={[track]} onNavigate={() => {}} showArtwork />
      </ScrollContext.Provider>,
    );
    expect(screen.getByTestId("track-art").textContent).toBe("album-cover");
  });

  it("renders one navigable header for each contiguous album group", () => {
    library.albumById.set("alb-1", { title: "First Album", year: 2001 });
    library.albumById.set("alb-2", { title: "Second Album", year: 2002 });
    const tracks = [
      { trackId: "trk-1", title: "One", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [], albumId: "alb-1", albumTitle: "First Album", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } },
      { trackId: "trk-2", title: "Two", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [], albumId: "alb-1", albumTitle: "First Album", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } },
      { trackId: "trk-3", title: "Three", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [], albumId: "alb-2", albumTitle: "Second Album", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } },
    ] as Track[];
    const onNavigate = vi.fn();

    render(
      <ScrollContext.Provider value={null}>
        <TrackList client={{ setLove: vi.fn() } as unknown as Client} player={{ canPlay: () => true } as never} tracks={tracks} onNavigate={onNavigate} showAlbumHeaders />
      </ScrollContext.Provider>,
    );

    expect(screen.getAllByText("First Album")).toHaveLength(1);
    expect(screen.getAllByText("Second Album")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Second Album/ }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "album", albumId: "alb-2" });
  });
});
