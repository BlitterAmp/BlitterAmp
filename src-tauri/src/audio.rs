//! Native playback engine. Decoding and output run here in the Rust host via
//! rodio (→ cpal), replacing the webview <audio> element: it plays everything
//! symphonia decodes (flac/mp3/aac/alac/vorbis/wav — not opus), does real
//! gapless transitions, and preloads the upcoming tracks to a temp cache so a
//! transition never stalls on the network.
//!
//! The webview Player (player.ts) owns queue + transport semantics and drives
//! this via commands; we report position and self-advances (when a staged next
//! track begins gaplessly, or the queue drains) back as Tauri events.
//!
//! cpal's stream is `!Send`, so it lives forever on its own thread; the rodio
//! `Player` (a handle, `Send + Sync`) is what we actually hold and share.

use std::collections::HashSet;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rodio::decoder::DecoderBuilder;
use rodio::{DeviceSinkBuilder, Player, Source};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::lru::Lru;

/// How long before a track ends we append the staged next, so its decoder is
/// primed for a seamless hand-off.
const GAPLESS_WINDOW: Duration = Duration::from_secs(8);
/// Downloaded track files kept on disk before LRU eviction.
const CACHE_CAPACITY: usize = 16;
const POLL: Duration = Duration::from_millis(200);
/// A hard cut (skip/jump) fades the outgoing track's volume to zero over this
/// many steps before clearing it, then fades the new one in — otherwise the
/// waveform is severed mid-sample and you hear a click. rodio samples the
/// volume control every ~5ms, so steps are spaced to match.
const FADE_STEPS: u32 = 8;
const FADE_STEP: Duration = Duration::from_millis(5);
const FADE_IN: Duration = Duration::from_millis(15);

#[derive(Clone)]
struct Conn {
    base_url: String,
    token: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PositionEvent {
    position_sec: f64,
    duration_sec: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AdvancedEvent {
    finished: usize,
    current_track_id: Option<String>,
}

// Playback errors surface by rejecting the audio_play_track command promise
// (the webview Player's .catch → onError), so there's no error event here.

/// Downloads track audio (via stream grants) to a temp dir, LRU-evicted.
struct FileCache {
    dir: PathBuf,
    http: reqwest::Client,
    lru: Mutex<Lru>,
    inflight: Mutex<HashSet<String>>,
}

fn sanitize(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

impl FileCache {
    fn new(dir: PathBuf, http: reqwest::Client) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        FileCache {
            dir,
            http,
            lru: Mutex::new(Lru::new(CACHE_CAPACITY)),
            inflight: Mutex::new(HashSet::new()),
        }
    }

    fn path(&self, id: &str) -> PathBuf {
        self.dir.join(sanitize(id))
    }

    /// Cache hit only — never downloads. Safe to call from the control thread.
    fn present(&self, id: &str) -> Option<PathBuf> {
        let p = self.path(id);
        if p.exists() {
            self.lru.lock().unwrap().touch(id);
            Some(p)
        } else {
            None
        }
    }

    /// Ensures `id` is on disk, downloading it if needed. Dedupes concurrent
    /// requests for the same track.
    async fn ensure(&self, conn: &Conn, id: &str) -> Result<PathBuf, String> {
        if let Some(p) = self.present(id) {
            return Ok(p);
        }
        let ours = {
            let mut fl = self.inflight.lock().unwrap();
            fl.insert(id.to_string()) // false if another task already owns it
        };
        if !ours {
            for _ in 0..100 {
                tokio::time::sleep(Duration::from_millis(50)).await;
                if let Some(p) = self.present(id) {
                    return Ok(p);
                }
            }
            return Err("timed out waiting for a concurrent download".into());
        }
        let result = self.download(conn, id).await;
        self.inflight.lock().unwrap().remove(id);
        let path = result?;
        let evicted = self.lru.lock().unwrap().insert(id.to_string());
        for e in evicted {
            let _ = std::fs::remove_file(self.path(&e));
        }
        Ok(path)
    }

    async fn download(&self, conn: &Conn, id: &str) -> Result<PathBuf, String> {
        let grant: serde_json::Value = self
            .http
            .post(format!("{}/v1/stream-grants", conn.base_url))
            .bearer_auth(&conn.token)
            .json(&serde_json::json!({ "trackId": id }))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let url = grant["url"].as_str().ok_or("stream grant missing url")?;
        // The grant bakes in the server's canonicalUrl, whose port goes stale
        // across engine relaunches (the bundled engine binds a fresh loopback
        // port each launch). The grant is host-independent, so fetch from the
        // base_url we're actually connected to, keeping only its path + query.
        let path_q = match url.find("://") {
            Some(i) => {
                let after = &url[i + 3..];
                after.find('/').map(|j| &after[j..]).unwrap_or("/")
            }
            None => url,
        };
        let full = format!("{}{}", conn.base_url.trim_end_matches('/'), path_q);
        let bytes = self
            .http
            .get(full)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        let tmp = self.path(id).with_extension("tmp");
        std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
        let final_path = self.path(id);
        std::fs::rename(&tmp, &final_path).map_err(|e| e.to_string())?;
        Ok(final_path)
    }
}

/// Mutable playback state. `desired_next` is what the webview wants staged; we
/// only actually append it to rodio inside the gapless window, so the webview
/// can change its mind cheaply until then.
struct Inner {
    player: Option<Player>,
    current: Option<String>,
    current_dur: Option<Duration>,
    desired_next: Option<String>,
    next_dur: Option<Duration>,
    appended_next: bool,
    prev_len: usize,
    resync: bool,
    volume: f32,
}

impl Inner {
    fn new(player: Option<Player>) -> Self {
        Inner {
            player,
            current: None,
            current_dur: None,
            desired_next: None,
            next_dur: None,
            appended_next: false,
            prev_len: 0,
            resync: false,
            volume: 1.0,
        }
    }
}

pub struct AudioEngine {
    inner: Arc<Mutex<Inner>>,
    cache: Arc<FileCache>,
    conn: Arc<Mutex<Option<Conn>>>,
}

/// Opens the default output on a dedicated thread (cpal's stream is `!Send` and
/// must outlive playback) and returns the shareable rodio handle.
fn spawn_output(app: AppHandle) -> Option<Player> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || match DeviceSinkBuilder::open_default_sink() {
        Ok(mut sink) => {
            sink.log_on_drop(false);
            let player = Player::connect_new(sink.mixer());
            let _ = tx.send(Some(player));
            loop {
                std::thread::park(); // keep `sink` (and the cpal stream) alive
            }
        }
        Err(e) => {
            crate::diagnostics::log(
                &app,
                crate::diagnostics::Level::Error,
                crate::diagnostics::Source::Desktop,
                format!("audio output unavailable: {e}"),
            );
            let _ = tx.send(None);
        }
    });
    rx.recv().ok().flatten()
}

fn open_decoder(path: &Path) -> Result<rodio::Decoder<BufReader<File>>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let byte_len = file.metadata().map_err(|e| e.to_string())?.len();
    DecoderBuilder::<BufReader<File>>::new()
        .with_data(BufReader::new(file))
        .with_byte_len(byte_len) // enables seeking + duration for mp3/vorbis
        .with_gapless(true)
        .build()
        .map_err(|e| e.to_string())
}

impl AudioEngine {
    pub fn new(app: &AppHandle) -> AudioEngine {
        let dir = app
            .path()
            .app_cache_dir()
            .or_else(|_| app.path().app_data_dir())
            .map(|d| d.join("audio-cache"))
            .unwrap_or_else(|_| std::env::temp_dir().join("blitteramp-audio"));
        let http = reqwest::Client::builder().build().unwrap_or_default();
        let cache = Arc::new(FileCache::new(dir, http));
        let inner = Arc::new(Mutex::new(Inner::new(spawn_output(app.clone()))));
        let engine = AudioEngine {
            inner: Arc::clone(&inner),
            cache: Arc::clone(&cache),
            conn: Arc::new(Mutex::new(None)),
        };
        spawn_control(app.clone(), inner, cache);
        engine
    }
}

/// The poll loop: emits position, appends the staged next inside the gapless
/// window, and detects when rodio has advanced to a new track.
fn spawn_control(app: AppHandle, inner: Arc<Mutex<Inner>>, cache: Arc<FileCache>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);
        let mut pos_evt: Option<PositionEvent> = None;
        let mut adv_evt: Option<AdvancedEvent> = None;
        {
            let mut g = inner.lock().unwrap();
            if g.player.is_none() {
                continue;
            }
            let len = g.player.as_ref().unwrap().len();
            let pos = g.player.as_ref().unwrap().get_pos();
            let volume = g.volume;

            // Prime the staged next as the current track nears its end.
            if g.current.is_some() && !g.appended_next {
                if let Some(next_id) = g.desired_next.clone() {
                    let near_end = g
                        .current_dur
                        .and_then(|d| d.checked_sub(pos))
                        .map(|left| left <= GAPLESS_WINDOW)
                        .unwrap_or(false);
                    if near_end {
                        if let Some(path) = cache.present(&next_id) {
                            if let Ok(dec) = open_decoder(&path) {
                                let dur = dec.total_duration();
                                g.player.as_ref().unwrap().append(dec);
                                g.player.as_ref().unwrap().set_volume(volume);
                                g.next_dur = dur;
                                g.appended_next = true;
                            }
                        }
                    }
                }
            }

            // Detect track boundaries by watching the queue length shrink.
            if g.resync {
                g.prev_len = len;
                g.resync = false;
            } else if len < g.prev_len {
                let finished = g.prev_len - len;
                if g.appended_next {
                    let new_current = g.desired_next.take();
                    g.current = new_current.clone();
                    g.current_dur = g.next_dur.take();
                    g.appended_next = false;
                    adv_evt = Some(AdvancedEvent {
                        finished,
                        current_track_id: new_current,
                    });
                } else {
                    g.current = None;
                    g.current_dur = None;
                    adv_evt = Some(AdvancedEvent {
                        finished,
                        current_track_id: None,
                    });
                }
                g.prev_len = len;
            } else {
                g.prev_len = len;
            }

            if g.current.is_some() {
                pos_evt = Some(PositionEvent {
                    position_sec: pos.as_secs_f64(),
                    duration_sec: g.current_dur.map(|d| d.as_secs_f64()).unwrap_or(0.0),
                });
            }
        }
        if let Some(e) = adv_evt {
            let _ = app.emit("audio://advanced", e);
        }
        if let Some(e) = pos_evt {
            let _ = app.emit("audio://position", e);
        }
    });
}

// ---- Tauri commands (driven by tauriBackend.ts) ----

#[tauri::command]
pub fn audio_configure(engine: tauri::State<'_, AudioEngine>, base_url: String, token: String) {
    *engine.conn.lock().unwrap() = Some(Conn { base_url, token });
}

#[tauri::command]
pub async fn audio_play_track(
    engine: tauri::State<'_, AudioEngine>,
    track_id: String,
    position_sec: f64,
) -> Result<(), String> {
    let conn = engine
        .conn
        .lock()
        .unwrap()
        .clone()
        .ok_or("audio not configured")?;
    let path = engine.cache.ensure(&conn, &track_id).await?;

    // If a track is playing, ramp it down before the abrupt clear() so the cut
    // lands on near-silence instead of severing the waveform (the click). The
    // new track then fades in from zero, smoothing the incoming edge too.
    let (had_current, volume) = {
        let g = engine.inner.lock().unwrap();
        (g.current.is_some(), g.volume)
    };
    if had_current {
        for step in (0..FADE_STEPS).rev() {
            {
                let g = engine.inner.lock().unwrap();
                if let Some(p) = g.player.as_ref() {
                    p.set_volume(volume * step as f32 / FADE_STEPS as f32);
                }
            }
            tokio::time::sleep(FADE_STEP).await;
        }
    }

    let faded = open_decoder(&path)?.fade_in(FADE_IN);
    let dur = faded.total_duration();
    let mut g = engine.inner.lock().unwrap();
    if g.player.is_none() {
        return Err("no audio output".into());
    }
    let volume = g.volume;
    let player = g.player.as_ref().unwrap();
    player.clear();
    player.append(faded);
    player.set_volume(volume);
    if position_sec > 0.0 {
        let _ = player.try_seek(Duration::from_secs_f64(position_sec));
    }
    player.play();
    g.current_dur = dur;
    g.current = Some(track_id);
    g.desired_next = None;
    g.next_dur = None;
    g.appended_next = false;
    g.resync = true; // clear()'s effect on len() is async; don't misread it
    Ok(())
}

#[tauri::command]
pub fn audio_stage_next(engine: tauri::State<'_, AudioEngine>, track_id: Option<String>) {
    let mut g = engine.inner.lock().unwrap();
    // Only meaningful before we've appended into the gapless window.
    if !g.appended_next {
        g.desired_next = track_id.clone();
    }
    drop(g);
    if let Some(id) = track_id {
        preload_one(&engine, id);
    }
}

#[tauri::command]
pub fn audio_preload(engine: tauri::State<'_, AudioEngine>, track_ids: Vec<String>) {
    for id in track_ids {
        preload_one(&engine, id);
    }
}

fn preload_one(engine: &AudioEngine, id: String) {
    let Some(conn) = engine.conn.lock().unwrap().clone() else {
        return;
    };
    let cache = Arc::clone(&engine.cache);
    tauri::async_runtime::spawn(async move {
        let _ = cache.ensure(&conn, &id).await;
    });
}

#[tauri::command]
pub fn audio_pause(engine: tauri::State<'_, AudioEngine>) {
    if let Some(p) = engine.inner.lock().unwrap().player.as_ref() {
        p.pause();
    }
}

#[tauri::command]
pub fn audio_resume(engine: tauri::State<'_, AudioEngine>) {
    if let Some(p) = engine.inner.lock().unwrap().player.as_ref() {
        p.play();
    }
}

#[tauri::command]
pub fn audio_seek(engine: tauri::State<'_, AudioEngine>, sec: f64) {
    if let Some(p) = engine.inner.lock().unwrap().player.as_ref() {
        let _ = p.try_seek(Duration::from_secs_f64(sec.max(0.0)));
    }
}

#[tauri::command]
pub fn audio_set_volume(engine: tauri::State<'_, AudioEngine>, volume: f32) {
    let mut g = engine.inner.lock().unwrap();
    g.volume = volume.clamp(0.0, 1.0);
    let v = g.volume;
    if let Some(p) = g.player.as_ref() {
        p.set_volume(v);
    }
}

#[tauri::command]
pub fn audio_stop(engine: tauri::State<'_, AudioEngine>) {
    let mut g = engine.inner.lock().unwrap();
    if let Some(p) = g.player.as_ref() {
        p.clear();
    }
    g.current = None;
    g.current_dur = None;
    g.desired_next = None;
    g.next_dur = None;
    g.appended_next = false;
    g.resync = true;
}
