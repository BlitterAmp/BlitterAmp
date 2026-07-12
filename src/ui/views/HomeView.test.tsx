// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client, HomeRails } from "../../api/client";
import { HomeView } from "./HomeView";

vi.mock("../MosaicArt", () => ({
  MosaicArt: ({ artIds }: { artIds: string[] }) => <span data-testid="mosaic">{artIds.join(",")}</span>,
}));
vi.mock("../AlbumArt", () => ({ AlbumArt: () => <span /> }));
vi.mock("../TrackList", () => ({ TrackList: () => null }));
vi.mock("../../state/useLibrarySync", () => ({ useLibraryVersion: () => 0 }));

afterEach(cleanup);

describe("HomeView", () => {
  it("uses mix collage art and navigates album artists independently", async () => {
    const home: HomeRails = { rails: [
      { kind: "mixes", title: "Made For You", mixes: [{ mixId: "mix-1", title: "Daily", collageArtIds: ["art-1", "art-2"] }] },
      { kind: "albums", title: "Albums", albums: [{ albumId: "alb-1", title: "Record", artistId: "art-1", artistName: "Artist", durationMs: 1, trackCount: 1 }] },
    ] } as HomeRails;
    const client = { home: vi.fn().mockResolvedValue(home) } as unknown as Client;
    const onNavigate = vi.fn();
    render(<HomeView client={client} player={{} as never} onNavigate={onNavigate} onOpenMix={() => {}} onOpenPlaylist={() => {}} />);

    expect((await screen.findByTestId("mosaic")).textContent).toBe("art-1,art-2");
    fireEvent.click(screen.getByRole("button", { name: "Artist" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-1" }));
  });
});
