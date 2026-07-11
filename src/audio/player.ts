// Webview <audio> playback engine, fed by short-lived stream grants (the
// audio element can't send the bearer header). WKWebView plays flac/mp3/m4a;
// ogg/opus waits for the mpv engine arc — the UI surfaces that honestly.
import { Client, type Track } from "../api/client";

export type PlayerState = {
  track: Track | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  error: string;
};

type Listener = (s: PlayerState) => void;

const WEBVIEW_PLAYABLE = new Set(["flac", "mp3", "m4a", "mp4", "aac"]);

export class Player {
  private audio = new Audio();
  private listeners = new Set<Listener>();
  private state: PlayerState = { track: null, playing: false, positionSec: 0, durationSec: 0, error: "" };
  private queue: Track[] = [];
  private queueIndex = -1;

  constructor(private client: Client) {
    this.audio.addEventListener("timeupdate", () => {
      this.patch({ positionSec: this.audio.currentTime, durationSec: this.audio.duration || 0 });
    });
    this.audio.addEventListener("play", () => this.patch({ playing: true }));
    this.audio.addEventListener("pause", () => this.patch({ playing: false }));
    this.audio.addEventListener("ended", () => void this.next());
    this.audio.addEventListener("error", () => {
      this.patch({ playing: false, error: "Playback failed for this track." });
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private patch(p: Partial<PlayerState>) {
    this.state = { ...this.state, ...p };
    for (const fn of this.listeners) fn(this.state);
  }

  canPlay(track: Track): boolean {
    return WEBVIEW_PLAYABLE.has(track.media.container);
  }

  async playQueue(tracks: Track[], startIndex = 0): Promise<void> {
    this.queue = tracks;
    this.queueIndex = startIndex - 1;
    await this.next();
  }

  async next(): Promise<void> {
    while (this.queueIndex + 1 < this.queue.length) {
      this.queueIndex += 1;
      const track = this.queue[this.queueIndex];
      if (!this.canPlay(track)) continue; // skip webview-unplayable containers for now
      await this.start(track);
      return;
    }
    this.audio.pause();
    this.patch({ track: null, playing: false, positionSec: 0, durationSec: 0 });
  }

  async previous(): Promise<void> {
    if (this.audio.currentTime > 3 || this.queueIndex <= 0) {
      this.audio.currentTime = 0;
      return;
    }
    this.queueIndex -= 2;
    await this.next();
  }

  private async start(track: Track): Promise<void> {
    try {
      const grant = await this.client.streamGrant(track.trackId);
      this.audio.src = grant.url;
      this.patch({ track, error: "", positionSec: 0, durationSec: track.durationMs / 1000 });
      await this.audio.play();
    } catch (err) {
      this.patch({ track, playing: false, error: err instanceof Error ? err.message : "Playback failed." });
    }
  }

  toggle(): void {
    if (this.audio.paused) void this.audio.play();
    else this.audio.pause();
  }

  seek(sec: number): void {
    this.audio.currentTime = sec;
  }
}
