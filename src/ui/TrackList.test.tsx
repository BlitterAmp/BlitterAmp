// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client, Track } from "../api/client";
import { ScrollContext } from "./ScrollContext";
import { TrackList } from "./TrackList";

vi.mock("./AlbumArt", () => ({ AlbumArt: ({ artId }: { artId?: string }) => <span data-testid="track-art">{artId}</span> }));
vi.mock("./PromptProvider", () => ({ usePrompt: () => vi.fn() }));
vi.mock("../state/playlists", () => ({ usePlaylists: () => ({ playlists: [], create: vi.fn(), append: vi.fn() }) }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 56 })),
  }),
}));

afterEach(cleanup);

describe("TrackList", () => {
  it("shows artwork instead of numbering and navigates from the artist name", () => {
    const track = { trackId: "trk-1", title: "Song", artistId: "art-1", artistName: "Artist", albumId: "alb-1", albumTitle: "Album", artId: "cover-1", durationMs: 1000, media: { container: "flac", audioCodec: "flac" } } as Track;
    const onNavigate = vi.fn();
    const player = { canPlay: () => true, playQueue: vi.fn() } as never;
    render(
      <ScrollContext.Provider value={null}>
        <TrackList client={{ setLove: vi.fn() } as unknown as Client} player={player} tracks={[track]} onNavigate={onNavigate} showAlbum showArtwork />
      </ScrollContext.Provider>,
    );

    expect(screen.getByTestId("track-art").textContent).toBe("cover-1");
    expect(screen.queryByText("1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Artist" }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-1" });
  });
});
