// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Album, Artist } from "../../api/client";

const library = vi.hoisted(() => ({ albums: [] as Album[], artists: [] as Artist[], ready: true }));

vi.mock("../../state/library", () => ({
  resyncLibrary: vi.fn(),
  useLibrary: () => library,
}));
vi.mock("../AlbumArt", () => ({
  AlbumArt: ({ alt }: { alt: string }) => <span data-testid="album-art">{alt}</span>,
}));
vi.mock("../Settings", () => ({ pickFolder: vi.fn() }));
vi.mock("../../state/engine", () => ({ setEngineSource: vi.fn() }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, getItemKey }: { count: number; getItemKey: (index: number) => string }) => ({
    getTotalSize: () => count * 200,
    getVirtualItems: () => Array.from({ length: Math.min(count, 8) }, (_, index) => ({
      index,
      key: getItemKey(index),
      start: index * 200,
    })),
    measureElement: vi.fn(),
  }),
}));

import { AlbumsView } from "./AlbumsView";
import { ArtistsView } from "./ArtistsView";

function album(index: number): Album {
  return {
    albumId: `album-${index}`,
    title: `Album ${index}`,
    primaryArtist: { artistId: `artist-${index}`, name: `Artist ${index}` },
    artistCredits: [{ artistId: `artist-${index}`, name: `Artist ${index}`, joinPhrase: "" }],
    artId: `album-art-${index}`,
    trackCount: 1,
  } as Album;
}

function artist(index: number): Artist {
  return {
    artistId: `artist-${index}`,
    name: `Artist ${index}`,
    artId: `artist-art-${index}`,
    albumCount: 1,
  } as Artist;
}

afterEach(() => {
  cleanup();
  library.albums = [];
  library.artists = [];
});

describe("virtualized library grids", () => {
  it("mounts only a bounded window of a large album library", () => {
    library.albums = Array.from({ length: 800 }, (_, index) => album(index));
    const onOpen = vi.fn();

    render(
      <AlbumsView
        client={{} as never}
        managed={false}
        onOpen={onOpen}
        onOpenArtist={() => {}}
        onManage={() => {}}
      />,
    );

    expect(screen.getAllByTestId("album-art").length).toBeLessThan(50);
    expect(screen.queryByText("Album 799")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Album 0/ }));
    expect(onOpen).toHaveBeenCalledWith("album-0");
  });

  it("mounts only a bounded window of a large artist library", () => {
    library.artists = Array.from({ length: 300 }, (_, index) => artist(index));
    const onOpen = vi.fn();

    render(<ArtistsView onOpen={onOpen} />);

    expect(screen.getAllByTestId("album-art").length).toBeLessThan(50);
    expect(screen.queryByText("Artist 299")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Artist 0/ }));
    expect(onOpen).toHaveBeenCalledWith("artist-0");
  });
});
