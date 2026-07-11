// Webview <audio> playback engine, fed by short-lived stream grants (the
// audio element can't send the bearer header). WKWebView plays flac/mp3/m4a;
// ogg/opus waits for the mpv engine arc — the UI surfaces that honestly. The
// player is a small reactive store: subscribe() for state, and it reports
// playback events to the server so taste/recently-played/presence work.
import { Client, type Track } from "../api/client";

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

const WEBVIEW_PLAYABLE = new Set(["flac", "mp3", "m4a", "mp4", "aac"]);

function uuid(): string {
  return crypto.randomUUID();
}

export class Player {
  private audio = new Audio();
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

  constructor(private client: Client) {
    this.audio.addEventListener("timeupdate", () => {
      this.patch({ positionSec: this.audio.currentTime, durationSec: this.audio.duration || 0 });
      // Periodic progress reports (every ~20s) feed scrobble/now-playing gates.
      if (this.state.track && this.audio.currentTime - this.lastReportedProgress > 20) {
        this.lastReportedProgress = this.audio.currentTime;
        this.report("progress", this.state.track, this.audio.currentTime);
      }
    });
    this.audio.addEventListener("play", () => this.patch({ playing: true }));
    this.audio.addEventListener("pause", () => this.patch({ playing: false }));
    this.audio.addEventListener("ended", () => {
      if (this.state.track) this.report("ended", this.state.track, this.state.durationSec);
      void this.advance(false);
    });
    this.audio.addEventListener("error", () => this.patch({ playing: false, error: "Playback failed for this track." }));
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
    return WEBVIEW_PLAYABLE.has(track.media.container);
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
    this.setQueue(queue, index - 1);
    await this.advance(false);
  }

  playNext(tracks: Track[]): void {
    const q = [...this.state.queue];
    q.splice(this.state.queueIndex + 1, 0, ...tracks);
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
    if (!this.state.track) void this.advance(false);
  }

  addToQueue(tracks: Track[]): void {
    const q = [...this.state.queue, ...tracks];
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
    if (!this.state.track) void this.advance(false);
  }

  removeFromQueue(index: number): void {
    if (index === this.state.queueIndex) return; // don't yank the playing track
    const q = [...this.state.queue];
    q.splice(index, 1);
    const newIndex = index < this.state.queueIndex ? this.state.queueIndex - 1 : this.state.queueIndex;
    this.ordered = q;
    this.setQueue(q, newIndex);
  }

  clearUpNext(): void {
    const q = this.state.queue.slice(0, this.state.queueIndex + 1);
    this.ordered = q;
    this.setQueue(q, this.state.queueIndex);
  }

  async jumpTo(index: number): Promise<void> {
    if (index < 0 || index >= this.state.queue.length) return;
    if (this.state.track) this.report("skipped", this.state.track, this.state.positionSec);
    this.setQueue(this.state.queue, index);
    await this.start(this.state.queue[index]);
  }

  /** Advances to the next playable track. `skipped` marks the current track a
   * skip (user pressed next) rather than a natural end. */
  private async advance(skipped: boolean): Promise<void> {
    if (this.state.repeat === "one" && this.state.track && !skipped) {
      await this.start(this.state.track);
      return;
    }
    let index = this.state.queueIndex;
    while (index + 1 < this.state.queue.length) {
      index += 1;
      if (this.canPlay(this.state.queue[index])) {
        this.setQueue(this.state.queue, index);
        await this.start(this.state.queue[index]);
        return;
      }
    }
    if (this.state.repeat === "all" && this.state.queue.some((t) => this.canPlay(t))) {
      this.setQueue(this.state.queue, -1);
      await this.advance(false);
      return;
    }
    this.audio.pause();
    this.patch({ track: null, playing: false, positionSec: 0, durationSec: 0, queueIndex: -1 });
  }

  async next(): Promise<void> {
    if (this.state.track) this.report("skipped", this.state.track, this.state.positionSec);
    await this.advance(true);
  }

  async previous(): Promise<void> {
    if (this.audio.currentTime > 3 || this.state.queueIndex <= 0) {
      this.audio.currentTime = 0;
      return;
    }
    let index = this.state.queueIndex - 1;
    while (index >= 0 && !this.canPlay(this.state.queue[index])) index -= 1;
    if (index < 0) {
      this.audio.currentTime = 0;
      return;
    }
    this.setQueue(this.state.queue, index);
    await this.start(this.state.queue[index]);
  }

  private async start(track: Track): Promise<void> {
    try {
      const grant = await this.client.streamGrant(track.trackId);
      this.audio.src = grant.url;
      this.audio.volume = this.state.volume;
      this.lastReportedProgress = 0;
      this.patch({ track, error: "", positionSec: 0, durationSec: track.durationMs / 1000 });
      await this.audio.play();
      this.report("started", track, 0);
    } catch (err) {
      this.patch({ track, playing: false, error: err instanceof Error ? err.message : "Playback failed." });
    }
  }

  toggle(): void {
    if (!this.state.track) return;
    if (this.audio.paused) {
      void this.audio.play();
      this.report("resumed", this.state.track, this.state.positionSec);
    } else {
      this.audio.pause();
      this.report("paused", this.state.track, this.state.positionSec);
    }
  }

  seek(sec: number): void {
    this.audio.currentTime = sec;
  }

  setVolume(v: number): void {
    const volume = Math.max(0, Math.min(1, v));
    this.audio.volume = volume;
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
  }

  setRepeat(repeat: Repeat): void {
    this.patch({ repeat });
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
