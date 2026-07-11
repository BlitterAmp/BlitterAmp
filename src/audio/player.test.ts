// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: Parameters<typeof fetch>) => fetch(...a) }));

import { Client, type Track } from "../api/client";
import { Player } from "./player";

function track(id: string, container = "flac"): Track {
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

function makeClient() {
  const client = new Client("http://s", "t");
  vi.spyOn(client, "streamGrant").mockImplementation(async (id: string) => ({
    url: `http://s/v1/stream/${id}?grant=x&exp=1`,
    expiresAt: "",
  }));
  const events: string[] = [];
  vi.spyOn(client, "post").mockImplementation(async (path: string, body?: unknown) => {
    if (path === "/v1/playback/events") {
      for (const e of (body as { events: { type: string }[] }).events) events.push(e.type);
    }
    return null as never;
  });
  return { client, events };
}

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

describe("Player queue", () => {
  it("exposes the queue and current index in state", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    let state = p.currentState();
    const unsub = p.subscribe((s) => (state = s));
    await p.playQueue([track("a"), track("b"), track("c")], 1);
    expect(state.queue.map((t) => t.trackId)).toEqual(["a", "b", "c"]);
    expect(state.queueIndex).toBe(1);
    expect(state.track?.trackId).toBe("b");
    unsub();
  });

  it("play-next inserts after the current track; add-to-queue appends", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a"), track("b")], 0);
    p.playNext([track("x")]);
    p.addToQueue([track("z")]);
    expect(p.currentState().queue.map((t) => t.trackId)).toEqual(["a", "x", "b", "z"]);
  });

  it("jumpTo plays a specific queue entry", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a"), track("b"), track("c")], 0);
    await p.jumpTo(2);
    expect(p.currentState().track?.trackId).toBe("c");
  });

  it("removeFromQueue drops entries and keeps the current index sane", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a"), track("b"), track("c")], 1);
    p.removeFromQueue(0); // remove 'a', current 'b' shifts to index 0
    expect(p.currentState().queue.map((t) => t.trackId)).toEqual(["b", "c"]);
    expect(p.currentState().track?.trackId).toBe("b");
  });

  it("repeat-one replays the same track on natural end; next() still advances", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a"), track("b")], 0);
    p.setRepeat("one");
    // Natural end → replay the same track.
    const audio = (p as unknown as { audio: HTMLAudioElement }).audio;
    audio.dispatchEvent(new Event("ended"));
    await Promise.resolve();
    await Promise.resolve();
    expect(p.currentState().track?.trackId).toBe("a");
    // Pressing next still moves forward.
    await p.next();
    expect(p.currentState().track?.trackId).toBe("b");
  });

  it("reports started and ended playback events to the server", async () => {
    const { client, events } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a"), track("b")], 0);
    await p.next(); // ends 'a' (as skipped→next), starts 'b'
    expect(events).toContain("started");
    expect(events.some((e) => e === "ended" || e === "skipped")).toBe(true);
  });

  it("skips webview-unplayable containers", async () => {
    const { client } = makeClient();
    const p = new Player(client);
    await p.playQueue([track("a", "ogg"), track("b", "flac"), track("c", "opus")]);
    expect(p.currentState().track?.trackId).toBe("b");
  });
});
