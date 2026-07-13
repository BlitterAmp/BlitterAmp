// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const scrollToOffset = vi.hoisted(() => vi.fn());
vi.mock("./AlbumArt", () => ({
  AlbumArt: ({ artId }: { artId?: string | null }) => <span data-testid="album-art">{artId}</span>,
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, getItemKey }: { count: number; getItemKey: (index: number) => string }) => ({
    scrollToOffset,
    getTotalSize: () => count * 48,
    getVirtualItems: () => Array.from({ length: Math.min(count, 15) }, (_, index) => ({
      index,
      key: getItemKey(index),
      size: 48,
      start: index * 48,
    })),
  }),
}));

import { Client, type Track } from "../api/client";
import type { AdvancedEvent, AudioBackend, AudioErrorEvent, PositionEvent } from "../audio/backend";
import { Player } from "../audio/player";
import { QueueDrawer } from "./QueueDrawer";

class TestBackend implements AudioBackend {
  private position?: (event: PositionEvent) => void;
  configure() {}
  playTrack() { return Promise.resolve(); }
  stageNext() {}
  preload() {}
  pause() {}
  resume() {}
  seek() {}
  setVolume() {}
  stop() {}
  onPosition(callback: (event: PositionEvent) => void) { this.position = callback; }
  onAdvanced(_callback: (event: AdvancedEvent) => void) {}
  onError(_callback: (event: AudioErrorEvent) => void) {}
  emitPosition(positionSec: number) { this.position?.({ positionSec, durationSec: 200 }); }
}

function track(index: number): Track {
  return {
    trackId: `track-${index}`,
    title: `Track ${index}`,
    primaryArtist: { artistId: `artist-${index}`, name: `Artist ${index}` },
    artistCredits: [{ artistId: `artist-${index}`, name: `Artist ${index}`, joinPhrase: "" }],
    albumId: `album-${index}`,
    albumTitle: `Album ${index}`,
    artId: `art-${index}`,
    durationMs: 200_000,
    media: { container: "flac", audioCodec: "flac" },
  } as Track;
}

function setup(size = 10_000) {
  const backend = new TestBackend();
  const client = new Client("http://server", "token");
  vi.spyOn(client, "post").mockResolvedValue(null as never);
  const player = new Player(client, backend);
  void player.playQueue(Array.from({ length: size }, (_, index) => track(index)));
  return { backend, client, player };
}

const queueRows = () => document.querySelectorAll<HTMLElement>("[data-index]");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  scrollToOffset.mockClear();
});

describe("QueueDrawer", () => {
  it("renders a bounded React DOM window from a mocked 10,000-row virtual range", async () => {
    const { client, player } = setup();
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);

    expect(screen.getByText("Now playing")).toBeTruthy();
    expect(screen.getByText("Up next")).toBeTruthy();
    await waitFor(() => expect(queueRows().length).toBeGreaterThan(0));
    expect(queueRows().length).toBeLessThan(30);
    expect(screen.queryByText("Track 9999")).toBeNull();
    expect(screen.getAllByTestId("album-art").length).toBeLessThan(30);
  });

  it("exposes the mounted up-next rows as a partial accessible list", async () => {
    const { client, player } = setup(100);
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);

    const list = await screen.findByRole("list", { name: "99 tracks up next" });
    const items = screen.getAllByRole("listitem");
    expect(list).toBeTruthy();
    expect(items).toHaveLength(15);
    expect(items[0].getAttribute("aria-setsize")).toBe("99");
    expect(items[0].getAttribute("aria-posinset")).toBe("1");
    expect(items[14].getAttribute("aria-posinset")).toBe("15");
  });

  it("does not rerender queue rows for position, volume, or playing updates, but does for queue changes", async () => {
    const { backend, client, player } = setup(100);
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);
    await waitFor(() => expect(queueRows().length).toBeGreaterThan(0));
    const firstRow = queueRows()[0];

    backend.emitPosition(1);
    player.setVolume(0.5);
    player.toggle();
    expect(queueRows()[0]).toBe(firstRow);

    player.removeFromQueue(1);
    await waitFor(() => expect(queueRows()[0]).not.toBe(firstRow));
  });

  it("applies the projected scroll origin when playback advances or jumps", async () => {
    const { client, player } = setup(100);
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);
    const scroller = (await screen.findByRole("list")).parentElement as HTMLElement;
    scroller.scrollTop = 240;

    await player.next();
    expect(scrollToOffset).toHaveBeenLastCalledWith(192);

    scroller.scrollTop = 240;
    fireEvent.click(screen.getByText("Track 7"));
    expect(scrollToOffset).toHaveBeenLastCalledWith(0);
  });

  it("jumps using the projected absolute queue index", async () => {
    const { client, player } = setup(20);
    const jump = vi.spyOn(player, "jumpTo");
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);
    await waitFor(() => expect(queueRows().length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText("Track 4"));
    expect(jump).toHaveBeenCalledWith(4);
    expect(player.currentState().track?.trackId).toBe("track-4");
    expect(screen.getByText("Track 5")).toBeTruthy();
  });

  it("navigates from an artist without jumping the queue", async () => {
    const { client, player } = setup(3);
    const navigate = vi.fn();
    const jump = vi.spyOn(player, "jumpTo");
    render(<QueueDrawer client={client} player={player} onClose={() => {}} onNavigate={navigate} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Artist 1" }))[0]);
    expect(navigate).toHaveBeenCalledWith({ name: "artist", artistId: "artist-1" });
    expect(jump).not.toHaveBeenCalled();
  });

  it("removes the intended duplicate occurrence and updates absolute indices", async () => {
    const { client, player } = setup(6);
    const duplicate = { ...track(2), trackId: "track-1", title: "Track 1 duplicate" };
    player.addToQueue([duplicate]);
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);

    fireEvent.click(await screen.findByText("Track 1 duplicate"));
    expect(player.currentState().queueIndex).toBe(6);
    await player.jumpTo(0);
    fireEvent.click(screen.getAllByLabelText("Remove")[0]);
    expect(player.currentState().queue.map((item) => item.title)).not.toContain("Track 1");
    expect(player.currentState().queue.map((item) => item.title)).toContain("Track 1 duplicate");
    expect(screen.getByText("Track 2")).toBeTruthy();
  });

  it("clears up next and closes", async () => {
    const { client, player } = setup(20);
    const close = vi.fn();
    render(<QueueDrawer client={client} player={player} onClose={close} />);
    await waitFor(() => expect(queueRows().length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByLabelText("Remove")[0]);
    expect(player.currentState().queue).toHaveLength(19);
    fireEvent.click(screen.getByText("Clear"));
    expect(player.currentState().queue).toHaveLength(player.currentState().queueIndex + 1);
    fireEvent.click(screen.getByLabelText("Close queue"));
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows the empty state", () => {
    const { client, player } = setup(0);
    render(<QueueDrawer client={client} player={player} onClose={() => {}} />);
    expect(screen.getByText("The queue is empty.")).toBeTruthy();
  });
});
