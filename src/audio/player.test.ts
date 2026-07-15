import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: Parameters<typeof fetch>) => fetch(...a) }));

import { Client, type Track } from "../api/client";
import type { AdvancedEvent, AudioBackend, AudioErrorEvent, PositionEvent } from "./backend";
import { PRELOAD_COUNT, Player } from "./player";

function track(id: string, container = "flac"): Track {
  return {
    trackId: id,
    title: id,
    primaryArtist: { artistId: "art_x", name: "A" },
    artistCredits: [{ artistId: "art_x", name: "A", joinPhrase: "" }],
    albumId: "alb_x",
    albumTitle: "Al",
    durationMs: 2000,
    media: { container, audioCodec: container },
  } as Track;
}

/** Records backend calls and lets a test fire Rust-side events by hand. */
class FakeBackend implements AudioBackend {
  played: string[] = [];
  playedPositions: number[] = [];
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
  async playTrack(id: string, positionSec = 0) {
    this.played.push(id);
    this.playedPositions.push(positionSec);
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
  const reported: { type: string; playSessionId: string }[] = [];
  vi.spyOn(client, "post").mockImplementation(async (path: string, body?: unknown) => {
    if (path === "/v1/playback/events") {
      for (const e of (body as { events: { type: string; playSessionId: string }[] }).events) {
        events.push(e.type);
        reported.push(e);
      }
    }
    return null as never;
  });
  return { client, events, reported };
}

function setup() {
  const { client, events, reported } = makeClient();
  const backend = new FakeBackend();
  const p = new Player(client, backend);
  let state = p.currentState();
  p.subscribe((s) => (state = s));
  return { p, backend, events, reported, get: () => state };
}

function sessions(reported: { type: string; playSessionId: string }[]) {
  return reported.reduce<Record<string, string[]>>((bySession, event) => {
    (bySession[event.playSessionId] ??= []).push(event.type);
    return bySession;
  }, {});
}

function expectOneTerminalPerSession(reported: { type: string; playSessionId: string }[]) {
  for (const events of Object.values(sessions(reported))) {
    expect(events.filter((type) => type === "ended" || type === "skipped")).toHaveLength(1);
  }
}

describe("Player", () => {
  it("restores a duplicate queue paused and resumes from its saved position", () => {
    const { p, backend, events, get } = setup();
    const a = track("a");
    const b = track("b");

    p.restore({
      version: 1,
      queueTrackIds: ["a", "b", "a"],
      orderedTrackIds: ["a", "b", "a"],
      queueIndex: 2,
      positionSec: 1.25,
      volume: 0.4,
      shuffle: true,
      repeat: "all",
    }, new Map([["a", a], ["b", b]]));

    expect(get()).toMatchObject({ track: a, queueIndex: 2, positionSec: 1.25, volume: 0.4, playing: false, shuffle: true, repeat: "all" });
    expect(get().queue.map((item) => item.trackId)).toEqual(["a", "b", "a"]);
    expect(backend.played).toEqual([]);
    expect(events).toEqual([]);

    p.toggle();
    expect(backend.played).toEqual(["a"]);
    expect(backend.playedPositions).toEqual([1.25]);
    expect(events).toEqual(["started"]);
    expect(get().playing).toBe(true);
  });

  it("uses the next surviving playable track when the saved current track is stale", () => {
    const { p, backend, get } = setup();
    const a = track("a");
    const c = track("c");

    p.restore({
      version: 1,
      queueTrackIds: ["a", "missing", "c"],
      orderedTrackIds: ["a", "missing", "c"],
      queueIndex: 1,
      positionSec: 20,
      volume: 0.7,
      shuffle: false,
      repeat: "off",
    }, new Map([["a", a], ["c", c]]));

    expect(get()).toMatchObject({ track: c, queueIndex: 1, positionSec: 0, playing: false });
    expect(get().queue.map((item) => item.trackId)).toEqual(["a", "c"]);
    expect(backend.played).toEqual([]);
  });

  it("shuffles the initial track when starting a shuffled set", async () => {
    const { p, backend, get } = setup();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("localStorage", { getItem: () => "random" });
    try {
      await p.playShuffled([track("a"), track("b"), track("c")]);

      expect(backend.played).toEqual(["b"]);
      expect(get().queue.map((item) => item.trackId)).toEqual(["b", "c", "a"]);
      expect(get().shuffle).toBe(true);
    } finally {
      random.mockRestore();
      vi.unstubAllGlobals();
    }
  });

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

  it("keeps backend staging bounded for a 10,000-track queue", async () => {
    const { p, backend } = setup();
    const many = Array.from({ length: 10_000 }, (_, index) => track(String(index)));
    await p.playQueue(many);

    expect(backend.staged).toEqual(["1"]);
    expect(backend.preloaded).toEqual([["1", "2", "3"].slice(0, PRELOAD_COUNT)]);
    expect(backend.preloaded.flat()).toHaveLength(PRELOAD_COUNT);
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

  it("uses one play session ID through a listen and a new ID for the next listen", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a"), track("b"), track("c")]);
    backend.emitPosition({ positionSec: 21, durationSec: 200 });
    p.toggle();
    p.toggle();
    backend.emitAdvanced({ finished: 1, currentTrackId: "b" });

    expect(reported.slice(0, 5).map((event) => event.type)).toEqual(["started", "progress", "paused", "resumed", "ended"]);
    expect(new Set(reported.slice(0, 5).map((event) => event.playSessionId)).size).toBe(1);
    expect(reported[5].type).toBe("started");
    expect(reported[5].playSessionId).not.toBe(reported[0].playSessionId);

    await p.next();
    expect(reported[6]).toMatchObject({ type: "skipped", playSessionId: reported[5].playSessionId });
    expect(reported[7].type).toBe("started");
    expect(reported[7].playSessionId).not.toBe(reported[5].playSessionId);
  });

  it("terminates sessions when a queue replaces playback, including replay", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a")]);
    await p.playQueue([track("b")]);
    await p.playQueue([track("b")]);
    backend.emitAdvanced({ finished: 1, currentTrackId: null });

    expect(Object.values(sessions(reported))).toEqual([
      ["started", "skipped"],
      ["started", "skipped"],
      ["started", "ended"],
    ]);
  });

  it("terminates the current session when previous moves tracks", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a"), track("b")], 1);
    backend.emitPosition({ positionSec: 2, durationSec: 2 });
    await p.previous();
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    expectOneTerminalPerSession(reported);
    expect(Object.values(sessions(reported))[0]).toEqual(["started", "skipped"]);
  });

  it("terminates errored sessions while advancing and at the queue boundary", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a"), track("b")]);
    backend.emitError({ trackId: "a", message: "decode failed" });
    backend.emitError({ trackId: "b", message: "decode failed" });
    expectOneTerminalPerSession(reported);
    expect(Object.values(sessions(reported)).map((events) => events[events.length - 1])).toEqual(["skipped", "skipped"]);
  });

  it("ignores a late error from a track that has already been replaced", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a"), track("b")]);
    await p.next();
    backend.emitError({ trackId: "a", message: "late failure" });
    expect(p.currentState().track?.trackId).toBe("b");
    expect(sessions(reported)[reported[reported.length - 1].playSessionId]).toEqual(["started"]);
  });

  it("ignores a late play rejection from an older replay of the same track", async () => {
    const { p, backend, reported } = setup();
    let rejectFirst!: (error: unknown) => void;
    vi.spyOn(backend, "playTrack")
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce();
    await p.playQueue([track("a")]);
    await p.playQueue([track("a")]);
    rejectFirst(new Error("late first attempt"));
    await Promise.resolve();

    expect(p.currentState().track?.trackId).toBe("a");
    expect(p.currentState().error).toBe("");
    expect(sessions(reported)[reported[reported.length - 1].playSessionId]).toEqual(["started"]);
  });

  it("uses one terminal event for natural end, repeat-one, repeat-all, jump, and null recovery", async () => {
    const { p, backend, reported } = setup();
    await p.playQueue([track("a"), track("b")]);
    await p.jumpTo(1);
    p.setRepeat("one");
    backend.emitAdvanced({ finished: 1, currentTrackId: "b" });
    p.setRepeat("all");
    backend.emitAdvanced({ finished: 1, currentTrackId: null });
    p.setRepeat("off");
    backend.emitAdvanced({ finished: 1, currentTrackId: "b" });
    backend.emitAdvanced({ finished: 1, currentTrackId: null });

    expectOneTerminalPerSession(reported);
    expect(Object.values(sessions(reported)).map((events) => events[events.length - 1])).toEqual([
      "skipped",
      "ended",
      "ended",
      "ended",
      "ended",
    ]);
  });
});
