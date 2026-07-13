// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client, Track } from "../api/client";
import { NowPlayingBar } from "./NowPlayingBar";

vi.mock("./AlbumArt", () => ({ AlbumArt: () => <span /> }));

afterEach(cleanup);

describe("NowPlayingBar", () => {
  it("updates love state optimistically and navigates to the artist", async () => {
    const track = { trackId: "trk-1", title: "Song", primaryArtist: { artistId: "art-1", name: "Artist" }, artistCredits: [{ artistId: "art-1", name: "Artist", joinPhrase: " & " }, { artistId: "art-2", name: "Guest", joinPhrase: "" }], albumId: "alb-1", albumTitle: "Album", loveState: "neutral" } as Track;
    const state = { track, playing: false, shuffle: false, repeat: "off", positionSec: 0, durationSec: 100, volume: 1 };
    const player = { currentState: () => state, subscribe: () => () => {}, toggleShuffle() {}, previous() {}, toggle() {}, next() {}, cycleRepeat() {}, seek() {}, setVolume() {} } as never;
    let resolve!: () => void;
    const setLove = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    const onNavigate = vi.fn();
    render(<NowPlayingBar client={{ setLove } as unknown as Client} player={player} queueOpen={false} onToggleQueue={() => {}} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    expect(screen.getByRole("button", { name: "Love" }).getAttribute("aria-pressed")).toBe("true");
    expect(setLove).toHaveBeenCalledWith("trk-1", "loved");
    fireEvent.click(screen.getByRole("button", { name: "Artist" }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-1" });
    fireEvent.click(screen.getByRole("button", { name: "Guest" }));
    expect(onNavigate).toHaveBeenCalledWith({ name: "artist", artistId: "art-2" });
    resolve();
    await waitFor(() => expect(setLove).toHaveBeenCalledOnce());
  });
});
