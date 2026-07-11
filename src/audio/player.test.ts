// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import { Client, type Track } from "../api/client";
import { Player } from "./player";

function track(id: string, container: string): Track {
  return {
    trackId: id,
    title: id,
    artistId: "art_x",
    artistName: "A",
    albumId: "alb_x",
    albumTitle: "Al",
    durationMs: 2000,
    media: { container, audioCodec: container },
  } as Track;
}

describe("Player", () => {
  it("knows which containers the webview can play", () => {
    const p = new Player(new Client("http://s", "t"));
    expect(p.canPlay(track("a", "flac"))).toBe(true);
    expect(p.canPlay(track("b", "mp3"))).toBe(true);
    expect(p.canPlay(track("c", "m4a"))).toBe(true);
    expect(p.canPlay(track("d", "ogg"))).toBe(false);
    expect(p.canPlay(track("e", "opus"))).toBe(false);
  });

  it("skips unplayable containers when advancing the queue", async () => {
    const grants: string[] = [];
    const client = new Client("http://s", "t");
    vi.spyOn(client, "streamGrant").mockImplementation(async (trackId: string) => {
      grants.push(trackId);
      return { url: `http://s/v1/stream/${trackId}?grant=x&exp=1`, expiresAt: "" };
    });
    // jsdom's HTMLMediaElement.play is unimplemented; stub it.
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    const p = new Player(client);
    await p.playQueue([track("t1", "ogg"), track("t2", "flac"), track("t3", "opus")]);
    expect(grants).toEqual(["t2"]);
  });
});
