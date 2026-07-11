// Reactive playback store. Owns queue + transport semantics; decode/output and
// gapless/preload live in the Rust host behind AudioBackend (backend.ts). The
// UI subscribes to PlayerState; the store reports playback events to the server
// so taste/recently-played/presence work. Rust drives two things back to us:
// position ticks, and self-advances when a staged next track begins gaplessly.
import { Client, type Track } from "../api/client";
import type { AdvancedEvent, AudioBackend, AudioErrorEvent, PositionEvent } from "./backend";

export type Repeat = "off" | "all" | "one";

export type PlayerState = {
  track: Track | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  shuffle: boolean;
  repeat: Repeat;
  queue: Track[];
  queueIndex: number;
  error: string;
};

type Listener = (s: PlayerState) => void;

/** How many upcoming tracks Rust keeps downloaded to the temp cache. */
export const PRELOAD_COUNT = 3;

// Containers rodio (symphonia-all) decodes. Opus is intentionally absent —
// symphonia doesn't ship an Opus codec — so those tracks are skipped honestly.
const RODIO_PLAYABLE = new Set([
  "flac",
  "mp3",
  "m4a",
  "mp4",
  "aac",
  "alac",
  "ogg",
  "oga",
  "vorbis",
  "wav",
  "aiff",
  "aif",
]);

function uuid(): string {
  return crypto.randomUUID();
}

export class Player {
  private listeners = new Set<Listener>();
  private state: PlayerState = {
    track: null,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    volume: 1,
    shuffle: false,
    repeat: "off",
    queue: [],
    queueIndex: -1,
    error: "",
  };
  /** Original (unshuffled) queue order, so toggling shuffle is reversible. */
  private ordered: Track[] = [];
  private lastReportedProgress = 0;

  constructor(
    private client: Client,
    private backend: AudioBackend,
  ) {
    this.backend.configure(client.baseUrl, client.authToken ?? "");
    this.backend.onPosition((e) => this.onPosition(e));
    this.backend.onAdvanced((e) => this.onAdvanced(e));
    this.backend.onError((e) => this.onError(e));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  currentState(): PlayerState {
    return this.state;
  }

  private patch(p: Partial<PlayerState>) {
    this.state = { ...this.state, ...p };
    for (const fn of this.listeners) fn(this.state);
  }

  private setQueue(queue: Track[], index: number) {
    this.patch({ queue, queueIndex: index });
  }

  canPlay(track: Track): boolean {
    return RODIO_PLAYABLE.has(track.media.container);
  }

  private firstPlayableFrom(queue: Track[], from: number): number {
    for (let i = Math.max(0, from); i < queue.length; i++) if (this.canPlay(queue[i])) return i;
    return -1;
  }

  private nextPlayableAfter(index: number): number {
    return this.firstPlayableFrom(this.state.queue, index + 1);
  }

  private prevPlayableBefore(index: number): number {
    for (let i = index - 1; i >= 0; i--) if (this.canPlay(this.state.queue[i])) return i;
    return -1;
  }

  private shuffled(tracks: Track[], keepFirst?: Track): Track[] {
    const rest = tracks.filter((t) => t !== keepFirst);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return keepFirst ? [keepFirst, ...rest] : rest;
  }

  async playQueue(tracks: Track[], startIndex = 0): Promise<void> {
    this.ordered = [...tracks];
    let queue = [...tracks];
    let index = startIndex;
    if (this.state.shuffle) {
      queue = this.shuffled(tracks, tracks[startIndex]);
      index = 0;
    }
    const first = this.firstPlayableFrom(queue, index);
    if (first < 0) {
      this.setQueue(queue, -1);
      this.stop();
      return;
    }
    this.setQueue(queue, first);
    this.start(queue[first]);
  }

  playNext(tracks: Track[]): void {
    const q = [...this.state.queue];
    q.splice(this.state.queueIndex + 1, 0, ...tracks);
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
    if (!this.state.track) void this.playQueue(tracks);
    else this.stageUpcoming(); // a new track may now be next in line
  }

  addToQueue(tracks: Track[]): void {
    const q = [...this.state.queue, ...tracks];
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
    if (!this.state.track) void this.playQueue(tracks);
    else this.stageUpcoming();
  }

  removeFromQueue(index: number): void {
    if (index === this.state.queueIndex) return; // don't yank the playing track
    const q = [...this.state.queue];
    q.splice(index, 1);
    const newIndex = index < this.state.queueIndex ? this.state.queueIndex - 1 : this.state.queueIndex;
    this.ordered = q;
    this.setQueue(q, newIndex);
    this.stageUpcoming(); // removed track may have been the staged next
  }

  clearUpNext(): void {
    const q = this.state.queue.slice(0, this.state.queueIndex + 1);
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
    this.stageUpcoming();
  }

  async jumpTo(index: number): Promise<void> {
    if (index < 0 || index >= this.state.queue.length) return;
    if (this.state.track) this.report("skipped", this.state.track, this.state.positionSec);
    this.setQueue(this.state.queue, index);
    this.start(this.state.queue[index]);
  }

  async next(): Promise<void> {
    if (this.state.track) this.report("skipped", this.state.track, this.state.positionSec);
    const next = this.nextPlayableAfter(this.state.queueIndex);
    if (next < 0) return this.onQueueEnd();
    this.setQueue(this.state.queue, next);
    this.start(this.state.queue[next]);
  }

  async previous(): Promise<void> {
    if (this.state.positionSec > 3 || this.state.queueIndex <= 0) {
      this.seek(0);
      return;
    }
    const prev = this.prevPlayableBefore(this.state.queueIndex);
    if (prev < 0) {
      this.seek(0);
      return;
    }
    this.setQueue(this.state.queue, prev);
    this.start(this.state.queue[prev]);
  }

  /** Hard-cut playback to a track (user action): clear, load, play from 0. */
  private start(track: Track): void {
    this.lastReportedProgress = 0;
    this.patch({ track, playing: true, error: "", positionSec: 0, durationSec: track.durationMs / 1000 });
    this.backend.playTrack(track.trackId).catch((err) => {
      this.onError({ trackId: track.trackId, message: err instanceof Error ? err.message : "Playback failed." });
    });
    this.report("started", track, 0);
    this.stageUpcoming();
  }

  /** Tell Rust which track to play gaplessly after the current one, and warm
   * the download cache for the next few. Depends on repeat mode. */
  private stageUpcoming(): void {
    if (!this.state.track) {
      this.backend.stageNext(null);
      return;
    }
    if (this.state.repeat === "one") {
      this.backend.stageNext(this.state.track.trackId);
      this.backend.preload([this.state.track.trackId]);
      return;
    }
    const next = this.nextPlayableAfter(this.state.queueIndex);
    this.backend.stageNext(next < 0 ? null : this.state.queue[next].trackId);
    // Warm the next few playable tracks so gapless transitions never stall.
    const upcoming: string[] = [];
    let i = this.state.queueIndex;
    while (upcoming.length < PRELOAD_COUNT && (i = this.nextPlayableAfter(i)) >= 0) {
      upcoming.push(this.state.queue[i].trackId);
    }
    this.backend.preload(upcoming);
  }

  /** Rust advanced on its own: a staged next began gaplessly, or the queue
   * drained (currentTrackId null). */
  private onAdvanced(e: AdvancedEvent): void {
    if (this.state.track) this.report("ended", this.state.track, this.state.durationSec);
    if (e.currentTrackId === null) {
      // The staged next wasn't ready in time (or there was none). Recover by
      // playing the next-in-line ourselves rather than assuming the queue ended.
      const next = this.nextPlayableAfter(this.state.queueIndex);
      if (next < 0) return this.onQueueEnd();
      this.setQueue(this.state.queue, next);
      this.start(this.state.queue[next]);
      return;
    }
    const index = this.state.repeat === "one" ? this.state.queueIndex : this.nextPlayableAfter(this.state.queueIndex);
    const track = index >= 0 ? this.state.queue[index] : this.state.track;
    if (!track) {
      this.onQueueEnd();
      return;
    }
    this.lastReportedProgress = 0;
    this.setQueue(this.state.queue, index >= 0 ? index : this.state.queueIndex);
    this.patch({ track, playing: true, positionSec: 0, durationSec: track.durationMs / 1000 });
    this.report("started", track, 0);
    this.stageUpcoming();
  }

  /** Reached the end of the queue with nothing staged. */
  private onQueueEnd(): void {
    if (this.state.repeat === "all") {
      const first = this.firstPlayableFrom(this.state.queue, 0);
      if (first >= 0) {
        this.setQueue(this.state.queue, first);
        this.start(this.state.queue[first]);
        return;
      }
    }
    this.stop();
  }

  private stop(): void {
    this.backend.stop();
    this.patch({ track: null, playing: false, positionSec: 0, durationSec: 0, queueIndex: -1 });
  }

  private onError(e: AudioErrorEvent): void {
    this.patch({ error: e.message || "Playback failed for this track." });
    const next = this.nextPlayableAfter(this.state.queueIndex);
    if (next < 0) return this.onQueueEnd();
    this.setQueue(this.state.queue, next);
    this.start(this.state.queue[next]);
  }

  private onPosition(e: PositionEvent): void {
    this.patch({ positionSec: e.positionSec, durationSec: e.durationSec || this.state.durationSec });
    // Periodic progress reports (~every 20s) feed scrobble/now-playing gates.
    if (this.state.track && e.positionSec - this.lastReportedProgress > 20) {
      this.lastReportedProgress = e.positionSec;
      this.report("progress", this.state.track, e.positionSec);
    }
  }

  toggle(): void {
    if (!this.state.track) return;
    if (this.state.playing) {
      this.backend.pause();
      this.patch({ playing: false });
      this.report("paused", this.state.track, this.state.positionSec);
    } else {
      this.backend.resume();
      this.patch({ playing: true });
      this.report("resumed", this.state.track, this.state.positionSec);
    }
  }

  seek(sec: number): void {
    this.backend.seek(sec);
    this.patch({ positionSec: sec });
  }

  setVolume(v: number): void {
    const volume = Math.max(0, Math.min(1, v));
    this.backend.setVolume(volume);
    this.patch({ volume });
  }

  toggleShuffle(): void {
    const shuffle = !this.state.shuffle;
    const current = this.state.track;
    let queue: Track[];
    let index: number;
    if (shuffle) {
      queue = this.shuffled(this.ordered, current ?? undefined);
      index = current ? 0 : -1;
    } else {
      queue = [...this.ordered];
      index = current ? queue.indexOf(current) : -1;
    }
    this.patch({ shuffle });
    this.setQueue(queue, index);
    this.stageUpcoming(); // the next-in-line changed
  }

  setRepeat(repeat: Repeat): void {
    this.patch({ repeat });
    this.stageUpcoming(); // staging depends on repeat mode
  }

  cycleRepeat(): void {
    const order: Repeat[] = ["off", "all", "one"];
    this.setRepeat(order[(order.indexOf(this.state.repeat) + 1) % 3]);
  }

  private report(type: string, track: Track, positionSec: number): void {
    void this.client
      .post("/v1/playback/events", {
        events: [{ eventId: uuid(), type, trackId: track.trackId, positionSec, at: new Date().toISOString() }],
      })
      .catch(() => {
        /* reporting is best-effort — never breaks playback */
      });
  }
}
