import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: Parameters<typeof fetch>) => fetch(...a) }));

import { Client, type Track } from "../api/client";
import type { AdvancedEvent, AudioBackend, AudioErrorEvent, PositionEvent } from "./backend";
import { PRELOAD_COUNT, Player } from "./player";

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

/** Records backend calls and lets a test fire Rust-side events by hand. */
class FakeBackend implements AudioBackend {
  played: string[] = [];
  staged: (string | null)[] = [];
  preloaded: string[][] = [];
  paused = 0;
  resumed = 0;
  seeks: number[] = [];
  volumes: number[] = [];
  private pos?: (e: PositionEvent) => void;
  private adv?: (e: AdvancedEvent) => void;
  private err?: (e: AudioErrorEvent) => void;

  configure() {}
  async playTrack(id: string) {
    this.played.push(id);
  }
  stageNext(id: string | null) {
    this.staged.push(id);
  }
  preload(ids: string[]) {
    this.preloaded.push(ids);
  }
  pause() {
    this.paused++;
  }
  resume() {
    this.resumed++;
  }
  seek(s: number) {
    this.seeks.push(s);
  }
  setVolume(v: number) {
    this.volumes.push(v);
  }
  stop() {}
  onPosition(cb: (e: PositionEvent) => void) {
    this.pos = cb;
  }
  onAdvanced(cb: (e: AdvancedEvent) => void) {
    this.adv = cb;
  }
  onError(cb: (e: AudioErrorEvent) => void) {
    this.err = cb;
  }
  // ---- test drivers ----
  emitPosition(e: PositionEvent) {
    this.pos?.(e);
  }
  emitAdvanced(e: AdvancedEvent) {
    this.adv?.(e);
  }
  emitError(e: AudioErrorEvent) {
    this.err?.(e);
  }
  lastStaged() {
    return this.staged[this.staged.length - 1];
  }
  lastPreload() {
    return this.preloaded[this.preloaded.length - 1] ?? [];
  }
}

function makeClient() {
  const client = new Client("http://s", "t");
  const events: string[] = [];
  vi.spyOn(client, "post").mockImplementation(async (path: string, body?: unknown) => {
    if (path === "/v1/playback/events") {
      for (const e of (body as { events: { type: string }[] }).events) events.push(e.type);
    }
    return null as never;
  });
  return { client, events };
}

function setup() {
  const { client, events } = makeClient();
  const backend = new FakeBackend();
  const p = new Player(client, backend);
  let state = p.currentState();
  p.subscribe((s) => (state = s));
  return { p, backend, events, get: () => state };
}

describe("Player", () => {
  it("plays the current track and stages the next on playQueue", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a"), track("b"), track("c")], 0);
    expect(backend.played).toEqual(["a"]);
    expect(backend.lastStaged()).toBe("b");
    expect(get().track?.trackId).toBe("a");
    expect(get().queueIndex).toBe(0);
  });

  it(`preloads up to ${PRELOAD_COUNT} upcoming playable tracks`, async () => {
    const { p, backend } = setup();
    const many = ["a", "b", "c", "d", "e", "f"].map((id) => track(id));
    await p.playQueue(many, 0);
    expect(backend.lastPreload()).toEqual(["b", "c", "d"].slice(0, PRELOAD_COUNT));
  });

  it("gapless advance moves to the staged next, reports ended+started, re-stages", async () => {
    const { p, backend, events, get } = setup();
    await p.playQueue([track("a"), track("b"), track("c")], 0);
    backend.emitAdvanced({ finished: 1, currentTrackId: "b" });
    expect(get().track?.trackId).toBe("b");
    expect(get().queueIndex).toBe(1);
    expect(events).toContain("ended");
    expect(events).toContain("started");
    expect(backend.lastStaged()).toBe("c"); // re-stage the new next
  });

  it("stops when the queue drains (advanced with null current)", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a")], 0);
    expect(backend.lastStaged()).toBe(null); // nothing to stage after the last track
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    expect(get().track).toBe(null);
    expect(get().playing).toBe(false);
  });

  it("recovers when a null advance arrives but tracks remain (slow preload)", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a"), track("b"), track("c")], 0);
    // Rust couldn't stage 'b' in time and reports a bare end — don't stop; play 'b'.
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    expect(get().track?.trackId).toBe("b");
    expect(backend.played).toEqual(["a", "b"]);
  });

  it("repeat-all restarts from the top when the queue drains", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a"), track("b")], 1); // start on last
    p.setRepeat("all");
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    expect(get().track?.trackId).toBe("a");
    expect(get().queueIndex).toBe(0);
  });

  it("repeat-one stages the same track and stays on it", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a"), track("b")], 0);
    p.setRepeat("one");
    expect(backend.lastStaged()).toBe("a"); // re-stage self for gapless loop
    backend.emitAdvanced({ finished: 1, currentTrackId: "a" });
    expect(get().track?.trackId).toBe("a");
    expect(get().queueIndex).toBe(0);
  });

  it("next() hard-cuts to the next track and reports a skip", async () => {
    const { p, backend, events, get } = setup();
    await p.playQueue([track("a"), track("b")], 0);
    await p.next();
    expect(backend.played).toEqual(["a", "b"]);
    expect(get().track?.trackId).toBe("b");
    expect(events).toContain("skipped");
  });

  it("play-next inserts after current; add-to-queue appends", async () => {
    const { p } = setup();
    await p.playQueue([track("a"), track("b")], 0);
    p.playNext([track("x")]);
    p.addToQueue([track("z")]);
    expect(p.currentState().queue.map((t) => t.trackId)).toEqual(["a", "x", "b", "z"]);
  });

  it("removeFromQueue drops entries and keeps the current index sane", async () => {
    const { p } = setup();
    await p.playQueue([track("a"), track("b"), track("c")], 1);
    p.removeFromQueue(0);
    expect(p.currentState().queue.map((t) => t.trackId)).toEqual(["b", "c"]);
    expect(p.currentState().track?.trackId).toBe("b");
  });

  it("jumpTo plays a specific queue entry", async () => {
    const { p, backend } = setup();
    await p.playQueue([track("a"), track("b"), track("c")], 0);
    await p.jumpTo(2);
    expect(backend.played).toEqual(["a", "c"]);
    expect(p.currentState().track?.trackId).toBe("c");
  });

  it("position events update state and drive periodic progress reports", async () => {
    const { p, backend, events } = setup();
    await p.playQueue([track("a")], 0);
    backend.emitPosition({ positionSec: 21, durationSec: 200 });
    expect(p.currentState().positionSec).toBe(21);
    expect(events).toContain("progress");
  });

  it("plays ogg/vorbis (rodio decodes it) but skips opus (unsupported)", async () => {
    const { p } = setup();
    await p.playQueue([track("a", "opus"), track("b", "ogg"), track("c", "flac")]);
    expect(p.currentState().track?.trackId).toBe("b");
  });

  it("a decode error skips to the next track", async () => {
    const { p, backend, get } = setup();
    await p.playQueue([track("a"), track("b")], 0);
    backend.emitError({ trackId: "a", message: "decode failed" });
    expect(get().track?.trackId).toBe("b");
  });

  it("toggle pauses and resumes via the backend", async () => {
    const { p, backend } = setup();
    await p.playQueue([track("a")], 0);
    p.toggle();
    expect(backend.paused).toBe(1);
    p.toggle();
    expect(backend.resumed).toBe(1);
  });
});
