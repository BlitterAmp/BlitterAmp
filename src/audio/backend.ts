// The audio backend contract. Playback lives in the Rust host (rodio → cpal):
// it decodes locally, holds one staged "next" track for sample-accurate
// gapless, downloads the upcoming few tracks to a temp cache, and reports
// position/advance/error back up. The webview Player (player.ts) owns queue and
// transport semantics and drives this backend. Splitting it this way keeps the
// UI unchanged while moving decode off the WKWebView <audio> element (which
// can't play ogg, and never did true gapless).

export interface PositionEvent {
  positionSec: number;
  durationSec: number;
}

/** Emitted when the Rust queue advances on its own — a staged next track began
 * gaplessly (or the queue drained). `finished` is how many tracks completed
 * since the last event; `currentTrackId` is the new front, or null if empty. */
export interface AdvancedEvent {
  finished: number;
  currentTrackId: string | null;
}

export interface AudioErrorEvent {
  trackId: string;
  message: string;
}

export interface AudioBackend {
  /** Point the backend at a server so it can mint stream grants + download. */
  configure(baseUrl: string, token: string): void;
  /** Hard-cut: clear the queue, load this track, seek, then start output. */
  playTrack(trackId: string, positionSec?: number): Promise<void>;
  /** Stage the gapless next track (or null to clear the staged slot). */
  stageNext(trackId: string | null): void;
  /** Ensure these tracks are downloaded to the temp cache (fire-and-forget). */
  preload(trackIds: string[]): void;
  pause(): void;
  resume(): void;
  seek(sec: number): void;
  setVolume(v: number): void;
  stop(): void;
  onPosition(cb: (e: PositionEvent) => void): void;
  onAdvanced(cb: (e: AdvancedEvent) => void): void;
  onError(cb: (e: AudioErrorEvent) => void): void;
}
