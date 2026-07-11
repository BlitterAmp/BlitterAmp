// Real AudioBackend: bridges the webview Player to the rodio engine in the Rust
// host. Commands go out via invoke(); position/advance/error come back as
// Tauri events. Only ever instantiated in the running app — tests use a fake.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AdvancedEvent, AudioBackend, AudioErrorEvent, PositionEvent } from "./backend";

export class TauriAudioBackend implements AudioBackend {
  configure(baseUrl: string, token: string): void {
    void invoke("audio_configure", { baseUrl, token });
  }
  playTrack(trackId: string): Promise<void> {
    return invoke("audio_play_track", { trackId });
  }
  stageNext(trackId: string | null): void {
    void invoke("audio_stage_next", { trackId });
  }
  preload(trackIds: string[]): void {
    void invoke("audio_preload", { trackIds });
  }
  pause(): void {
    void invoke("audio_pause");
  }
  resume(): void {
    void invoke("audio_resume");
  }
  seek(sec: number): void {
    void invoke("audio_seek", { sec });
  }
  setVolume(v: number): void {
    void invoke("audio_set_volume", { volume: v });
  }
  stop(): void {
    void invoke("audio_stop");
  }
  onPosition(cb: (e: PositionEvent) => void): void {
    void listen<PositionEvent>("audio://position", (e) => cb(e.payload));
  }
  onAdvanced(cb: (e: AdvancedEvent) => void): void {
    void listen<AdvancedEvent>("audio://advanced", (e) => cb(e.payload));
  }
  onError(cb: (e: AudioErrorEvent) => void): void {
    void listen<AudioErrorEvent>("audio://error", (e) => cb(e.payload));
  }
}
