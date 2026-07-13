//! Local library mirror + delta-sync. The webview renders the WHOLE catalog
//! (no pagination), so the Rust host keeps a persistent SQLite mirror of the
//! server's Artists/Albums/Tracks/Playlists and syncs it efficiently:
//!
//!   bootstrap (page the list endpoints once) → delta (GET /v1/changes?since=)
//!   → live (SSE /v1/events: library.changed pulls a delta, playlist.changed
//!   refetches one playlist, love.updated patches in place).
//!
//! Against a REMOTE server this means a reconnect re-fetches nothing when the
//! library is unchanged — the whole point. Album art is cached on disk by art
//! id (immutable per id), so it's fetched once and never again.
//!
//! Entities are stored as JSON blobs (the exact API shapes); the webview loads
//! them via library_snapshot and sorts/filters in JS. We emit `library:changed`
//! whenever the mirror moves so the webview re-reads.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{watch, Semaphore};

const READ_MODEL_VERSION: &str = "3";
const ART_FETCH_CONCURRENCY: usize = 6;
const ART_NEGATIVE_TTL: Duration = Duration::from_secs(120);
const NOTIFY_DEBOUNCE: Duration = Duration::from_millis(250);

type ArtResult = Result<Vec<u8>, String>;
type ArtInflight = HashMap<String, watch::Sender<Option<ArtResult>>>;

#[derive(Clone)]
struct Conn {
    base_url: String,
    token: String,
    identity: String,
}

// ── the mirror (pure SQLite; unit-testable) ─────────────────────

struct Mirror {
    db: Connection,
}

impl Mirror {
    fn open(path: &PathBuf) -> rusqlite::Result<Mirror> {
        let db = Connection::open(path)?;
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind, id));
             CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        )?;
        Ok(Mirror { db })
    }

    fn meta(&self, key: &str) -> Option<String> {
        self.db
            .query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| {
                r.get::<_, String>(0)
            })
            .ok()
    }

    fn set_meta(&self, key: &str, value: &str) {
        let _ = self.db.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        );
    }

    fn version(&self) -> i64 {
        self.meta("version")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0)
    }

    fn wipe(&self) {
        let _ = self.db.execute("DELETE FROM entities", []);
        let _ = self.db.execute("DELETE FROM meta", []);
    }

    fn prepare(&self, identity: &str) {
        let identity_changed = self.meta("identity").as_deref() != Some(identity);
        let model_changed = self.meta("read_model_version").as_deref() != Some(READ_MODEL_VERSION);
        if identity_changed || model_changed {
            self.wipe();
        }
        self.set_meta("identity", identity);
        self.set_meta("read_model_version", READ_MODEL_VERSION);
    }

    fn upsert(&self, kind: &str, id: &str, json: &str) {
        let _ = self.db.execute(
            "INSERT INTO entities (kind, id, json) VALUES (?1, ?2, ?3)
             ON CONFLICT(kind, id) DO UPDATE SET json = excluded.json",
            [kind, id, json],
        );
    }

    fn delete(&self, kind: &str, id: &str) {
        let _ = self.db.execute(
            "DELETE FROM entities WHERE kind = ?1 AND id = ?2",
            [kind, id],
        );
    }

    fn apply_bootstrap_page(
        &self,
        kind: &str,
        id_field: &str,
        items: &[Value],
        seen: &mut HashSet<String>,
        final_page: bool,
    ) -> rusqlite::Result<bool> {
        let tx = self.db.unchecked_transaction()?;
        let mut changed = false;
        for item in items {
            if let Some(id) = item.get(id_field).and_then(Value::as_str) {
                seen.insert(id.to_string());
                let json = item.to_string();
                let existing = tx
                    .query_row(
                        "SELECT json FROM entities WHERE kind = ?1 AND id = ?2",
                        [kind, id],
                        |row| row.get::<_, String>(0),
                    )
                    .ok();
                if existing.as_deref() != Some(json.as_str()) {
                    tx.execute(
                        "INSERT INTO entities (kind, id, json) VALUES (?1, ?2, ?3)
                         ON CONFLICT(kind, id) DO UPDATE SET json = excluded.json",
                        [kind, id, &json],
                    )?;
                    changed = true;
                }
            }
        }
        if final_page {
            let stale = {
                let mut stmt = tx.prepare("SELECT id FROM entities WHERE kind = ?1")?;
                let stale = stmt
                    .query_map([kind], |row| row.get::<_, String>(0))?
                    .collect::<rusqlite::Result<Vec<_>>>()?
                    .into_iter()
                    .filter(|id| !seen.contains(id))
                    .collect::<Vec<_>>();
                stale
            };
            for id in stale {
                tx.execute(
                    "DELETE FROM entities WHERE kind = ?1 AND id = ?2",
                    [kind, id.as_str()],
                )?;
                changed = true;
            }
        }
        tx.commit()?;
        Ok(changed)
    }

    fn snapshot(&self, kind: &str) -> Vec<Value> {
        let mut stmt = match self.db.prepare("SELECT json FROM entities WHERE kind = ?1") {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        let rows = stmt.query_map([kind], |r| r.get::<_, String>(0));
        let mut out = Vec::new();
        if let Ok(rows) = rows {
            for row in rows.flatten() {
                if let Ok(v) = serde_json::from_str::<Value>(&row) {
                    out.push(v);
                }
            }
        }
        out
    }

    /// Patch the embedded loveState of one entity (love.updated carries a ref
    /// like trk_/alb_/art_ that isn't a change_seq bump, so deltas miss it).
    fn patch_love(&self, kind: &str, id: &str, love_state: &Value) {
        if let Ok(json) = self.db.query_row(
            "SELECT json FROM entities WHERE kind = ?1 AND id = ?2",
            [kind, id],
            |r| r.get::<_, String>(0),
        ) {
            if let Ok(mut v) = serde_json::from_str::<Value>(&json) {
                if let Some(obj) = v.as_object_mut() {
                    obj.insert("loveState".into(), love_state.clone());
                    self.upsert(kind, id, &v.to_string());
                }
            }
        }
    }
}

fn sanitized_art_id(art_id: &str) -> String {
    art_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '_')
        .collect()
}

fn collect_art_ids(value: &Value, art_ids: &mut HashSet<String>) {
    match value {
        Value::Object(object) => {
            if let Some(art_id) = object.get("artId").and_then(Value::as_str) {
                art_ids.insert(sanitized_art_id(art_id));
            }
            for child in object.values() {
                collect_art_ids(child, art_ids);
            }
        }
        Value::Array(values) => {
            for child in values {
                collect_art_ids(child, art_ids);
            }
        }
        _ => {}
    }
}

fn prune_art_cache(mirror: &Mirror, art_dir: &Path) -> std::io::Result<usize> {
    let mut referenced = HashSet::new();
    for kind in ["artist", "album", "track", "playlist"] {
        for entity in mirror.snapshot(kind) {
            collect_art_ids(&entity, &mut referenced);
        }
    }

    let mut removed = 0;
    for entry in std::fs::read_dir(art_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        let Some((art_id, size)) = name.rsplit_once('_') else {
            continue;
        };
        if art_id.is_empty()
            || !art_id
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_')
            || size.is_empty()
            || !size.chars().all(|character| character.is_ascii_digit())
            || referenced.contains(art_id)
        {
            continue;
        }
        std::fs::remove_file(entry.path())?;
        removed += 1;
    }
    Ok(removed)
}

fn log_art_prune(app: &AppHandle, pruned: usize) {
    crate::diagnostics::log(
        app,
        crate::diagnostics::Level::Info,
        crate::diagnostics::Source::Desktop,
        format!("library bootstrap pruned {pruned} stale art files"),
    );
}

// ── the managed sync engine ─────────────────────────────────────

pub struct LibraryState {
    mirror: Mutex<Mirror>,
    conn: Mutex<Option<Conn>>,
    http: reqwest::Client,
    art_dir: PathBuf,
    art_inflight: Mutex<ArtInflight>,
    art_negative: Mutex<HashMap<String, Instant>>,
    art_fetches: Semaphore,
    running: Mutex<bool>,
}

impl LibraryState {
    pub fn new(app: &AppHandle) -> LibraryState {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("library");
        let _ = std::fs::create_dir_all(&dir);
        let art_dir = dir.join("art");
        let _ = std::fs::create_dir_all(&art_dir);
        let mirror = Mirror::open(&dir.join("mirror.db")).expect("open library mirror");
        LibraryState {
            mirror: Mutex::new(mirror),
            conn: Mutex::new(None),
            http: reqwest::Client::builder().build().unwrap_or_default(),
            art_dir,
            art_inflight: Mutex::new(HashMap::new()),
            art_negative: Mutex::new(HashMap::new()),
            art_fetches: Semaphore::new(ART_FETCH_CONCURRENCY),
            running: Mutex::new(false),
        }
    }

    fn conn(&self) -> Option<Conn> {
        self.conn.lock().unwrap().clone()
    }

    fn invalidate_negative_art(&self) {
        self.art_negative.lock().unwrap().clear();
    }

    async fn get_json(&self, conn: &Conn, path: &str) -> Result<Value, String> {
        self.http
            .get(format!("{}{}", conn.base_url.trim_end_matches('/'), path))
            .bearer_auth(&conn.token)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json::<Value>()
            .await
            .map_err(|e| e.to_string())
    }

    /// Page a cursor list endpoint into the mirror, replacing that kind.
    async fn bootstrap_list(
        &self,
        conn: &Conn,
        kind: &str,
        path: &str,
        id_field: &str,
        notify: &impl Fn(),
    ) -> Result<(), String> {
        let mut cursor = String::new();
        let mut seen = HashSet::new();
        loop {
            let sep = if path.contains('?') { '&' } else { '?' };
            let url = format!(
                "{}{}limit=500{}",
                path,
                sep,
                if cursor.is_empty() {
                    String::new()
                } else {
                    format!("&cursor={cursor}")
                }
            );
            let page = self.get_json(conn, &url).await?;
            let items = page
                .get("items")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let next_cursor = page
                .get("nextCursor")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_owned);
            let changed = {
                let m = self.mirror.lock().unwrap();
                m.apply_bootstrap_page(kind, id_field, &items, &mut seen, next_cursor.is_none())
                    .map_err(|e| e.to_string())?
            };
            if changed {
                notify();
            }
            match next_cursor {
                Some(c) => cursor = c,
                _ => break,
            }
        }
        Ok(())
    }

    async fn bootstrap_bare(
        &self,
        conn: &Conn,
        kind: &str,
        path: &str,
        id_field: &str,
        notify: &impl Fn(),
    ) -> Result<(), String> {
        let arr = self.get_json(conn, path).await?;
        let items = arr.as_array().map(Vec::as_slice).unwrap_or_default();
        let mut seen = HashSet::new();
        let changed = self
            .mirror
            .lock()
            .unwrap()
            .apply_bootstrap_page(kind, id_field, items, &mut seen, true)
            .map_err(|e| e.to_string())?;
        if changed {
            notify();
        }
        Ok(())
    }

    async fn bootstrap(
        &self,
        conn: &Conn,
        version: i64,
        notify: &impl Fn(),
    ) -> Result<usize, String> {
        self.bootstrap_list(conn, "artist", "/v1/artists", "artistId", notify)
            .await?;
        self.bootstrap_list(conn, "album", "/v1/albums", "albumId", notify)
            .await?;
        self.bootstrap_list(conn, "track", "/v1/tracks", "trackId", notify)
            .await?;
        self.bootstrap_bare(conn, "playlist", "/v1/playlists", "playlistId", notify)
            .await?;
        self.mirror
            .lock()
            .unwrap()
            .set_meta("version", &version.to_string());
        let mirror = self.mirror.lock().unwrap();
        prune_art_cache(&mirror, &self.art_dir).map_err(|error| error.to_string())
    }

    async fn sync_once(&self, conn: &Conn, notify: &impl Fn()) -> Result<Option<usize>, String> {
        let library = self.get_json(conn, "/v1/library").await?;
        let library_id = library
            .get("libraryId")
            .and_then(Value::as_str)
            .unwrap_or("lib_local");
        self.mirror
            .lock()
            .unwrap()
            .prepare(&library_identity(&conn.identity, library_id));
        let server_version = library.get("version").and_then(Value::as_i64).unwrap_or(0);
        let mirror_version = self.mirror.lock().unwrap().version();
        if mirror_version == 0 || server_version < mirror_version {
            return self.bootstrap(conn, server_version, notify).await.map(Some);
        }
        self.delta(conn, notify).await.map(|_| None)
    }

    /// Pull /v1/changes from the mirror's version until drained.
    async fn delta(&self, conn: &Conn, notify: &impl Fn()) -> Result<bool, String> {
        let mut since = self.mirror.lock().unwrap().version();
        let mut cursor = String::new();
        let mut changed = false;
        loop {
            let url = format!(
                "/v1/changes?since={since}{}",
                if cursor.is_empty() {
                    String::new()
                } else {
                    format!("&cursor={cursor}")
                }
            );
            let d = self.get_json(conn, &url).await?;
            let page_changed = {
                let m = self.mirror.lock().unwrap();
                let mut page_changed = false;
                for (arr, kind, idf) in [
                    ("artists", "artist", "artistId"),
                    ("albums", "album", "albumId"),
                    ("tracks", "track", "trackId"),
                ] {
                    if let Some(items) = d.get(arr).and_then(|v| v.as_array()) {
                        for it in items {
                            if let Some(id) = it.get(idf).and_then(|v| v.as_str()) {
                                let json = it.to_string();
                                let existing =
                                    m.db.query_row(
                                        "SELECT json FROM entities WHERE kind = ?1 AND id = ?2",
                                        [kind, id],
                                        |row| row.get::<_, String>(0),
                                    )
                                    .ok();
                                if existing.as_deref() != Some(json.as_str()) {
                                    m.upsert(kind, id, &json);
                                    page_changed = true;
                                }
                            }
                        }
                    }
                }
                for (arr, kind) in [
                    ("removedArtistIds", "artist"),
                    ("removedAlbumIds", "album"),
                    ("removedTrackIds", "track"),
                ] {
                    if let Some(ids) = d.get(arr).and_then(|v| v.as_array()) {
                        for id in ids.iter().filter_map(|v| v.as_str()) {
                            if m.db
                                .execute(
                                    "DELETE FROM entities WHERE kind = ?1 AND id = ?2",
                                    [kind, id],
                                )
                                .unwrap_or(0)
                                > 0
                            {
                                page_changed = true;
                            }
                        }
                    }
                }
                page_changed
            };
            if page_changed {
                changed = true;
                notify();
            }
            match d.get("nextCursor").and_then(|v| v.as_str()) {
                Some(c) if !c.is_empty() => cursor = c.to_string(),
                _ => {
                    let v = d.get("version").and_then(|v| v.as_i64()).unwrap_or(since);
                    self.mirror
                        .lock()
                        .unwrap()
                        .set_meta("version", &v.to_string());
                    since = v;
                    let _ = since;
                    break;
                }
            }
        }
        Ok(changed)
    }

    async fn refetch_playlist(&self, conn: &Conn, id: &str) -> Result<(), String> {
        match self.get_json(conn, &format!("/v1/playlists/{id}")).await {
            Ok(pl) => {
                self.mirror
                    .lock()
                    .unwrap()
                    .upsert("playlist", id, &pl.to_string());
                Ok(())
            }
            Err(_) => {
                // Gone (deleted) — drop it.
                self.mirror.lock().unwrap().delete("playlist", id);
                Ok(())
            }
        }
    }
}

fn library_identity(connection_identity: &str, library_id: &str) -> String {
    format!("{connection_identity}:{library_id}")
}

struct DebouncedNotifier {
    delay: Duration,
    callback: Arc<dyn Fn() + Send + Sync>,
    pending: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl DebouncedNotifier {
    fn new(delay: Duration, callback: impl Fn() + Send + Sync + 'static) -> Self {
        Self {
            delay,
            callback: Arc::new(callback),
            pending: Mutex::new(None),
        }
    }

    fn notify(&self) {
        let mut pending = self.pending.lock().unwrap();
        if let Some(task) = pending.take() {
            task.abort();
        }
        let delay = self.delay;
        let callback = Arc::clone(&self.callback);
        *pending = Some(tauri::async_runtime::spawn(async move {
            tokio::time::sleep(delay).await;
            callback();
        }));
    }
}

fn app_notifier(app: &AppHandle) -> Arc<DebouncedNotifier> {
    let app = app.clone();
    Arc::new(DebouncedNotifier::new(NOTIFY_DEBOUNCE, move || {
        app.state::<LibraryState>().invalidate_negative_art();
        let _ = app.emit("library:changed", ());
    }))
}

#[derive(Serialize)]
pub struct Snapshot {
    artists: Vec<Value>,
    albums: Vec<Value>,
    tracks: Vec<Value>,
    playlists: Vec<Value>,
}

// ── commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn library_configure(
    app: AppHandle,
    lib: tauri::State<'_, LibraryState>,
    base_url: String,
    token: String,
    identity: String,
) -> Result<(), String> {
    *lib.conn.lock().unwrap() = Some(Conn {
        base_url,
        token,
        identity,
    });

    // One sync loop at a time.
    {
        let mut running = lib.running.lock().unwrap();
        if *running {
            return Ok(());
        }
        *running = true;
    }
    tauri::async_runtime::spawn(async move {
        let state = app.state::<LibraryState>();
        run_sync(&app, &state).await;
        *state.running.lock().unwrap() = false;
    });
    Ok(())
}

async fn run_sync(app: &AppHandle, lib: &LibraryState) {
    let Some(conn) = lib.conn() else { return };
    let notifier = app_notifier(app);
    let notify = || notifier.notify();
    let result = lib.sync_once(&conn, &notify).await;
    if let Err(e) = &result {
        crate::diagnostics::log(
            app,
            crate::diagnostics::Level::Error,
            crate::diagnostics::Source::Desktop,
            format!("library initial sync failed: {e}"),
        );
        return;
    }
    if let Ok(Some(pruned)) = result {
        log_art_prune(app, pruned);
    }
    stream_events(app, lib, &conn, &notifier).await;
}

/// SSE loop over /v1/events, reconnecting with Last-Event-ID.
async fn stream_events(
    app: &AppHandle,
    lib: &LibraryState,
    conn: &Conn,
    notifier: &DebouncedNotifier,
) {
    let mut last_id = String::new();
    loop {
        // Bail if the connection changed under us (switched servers).
        if lib.conn().map(|c| c.identity) != Some(conn.identity.clone()) {
            return;
        }
        let mut req = lib
            .http
            .get(format!("{}/v1/events", conn.base_url.trim_end_matches('/')))
            .bearer_auth(&conn.token);
        if !last_id.is_empty() {
            req = req.header("Last-Event-ID", &last_id);
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(_) => {
                tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
                continue;
            }
        };
        let mut resp = resp;
        let mut buf = String::new();
        // Reads until the stream ends/errors, then falls through to reconnect.
        while let Ok(Some(bytes)) = resp.chunk().await {
            buf.push_str(&String::from_utf8_lossy(&bytes));
            while let Some(idx) = buf.find("\n\n") {
                let frame: String = buf.drain(..idx + 2).collect();
                handle_frame(app, lib, conn, &frame, &mut last_id, notifier).await;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    }
}

async fn handle_frame(
    app: &AppHandle,
    lib: &LibraryState,
    conn: &Conn,
    frame: &str,
    last_id: &mut String,
    notifier: &DebouncedNotifier,
) {
    let mut data = String::new();
    for line in frame.lines() {
        if let Some(v) = line.strip_prefix("id:") {
            *last_id = v.trim().to_string();
        } else if let Some(v) = line.strip_prefix("data:") {
            data.push_str(v.trim());
        }
    }
    if data.is_empty() {
        return; // heartbeat / comment
    }
    let Ok(env) = serde_json::from_str::<Value>(&data) else {
        return;
    };
    let typ = env.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let payload = env.get("data").cloned().unwrap_or(Value::Null);
    let changed = match typ {
        "library.changed" => {
            let notify = || notifier.notify();
            if let Ok(Some(pruned)) = lib.sync_once(conn, &notify).await {
                log_art_prune(app, pruned);
            }
            false
        }
        "playlist.changed" => {
            if let Some(id) = payload.get("playlistId").and_then(|v| v.as_str()) {
                let _ = lib.refetch_playlist(conn, id).await;
                true
            } else {
                false
            }
        }
        "love.updated" => {
            // ref is like trk_/alb_/art_… — patch the matching entity in place.
            if let (Some(r), state) = (
                payload.get("ref").and_then(|v| v.as_str()),
                payload.get("state").cloned(),
            ) {
                let kind = match &r[..r.find('_').map(|i| i + 1).unwrap_or(0)] {
                    "trk_" => "track",
                    "alb_" => "album",
                    "art_" => "artist",
                    _ => "",
                };
                if !kind.is_empty() {
                    lib.mirror
                        .lock()
                        .unwrap()
                        .patch_love(kind, r, &state.unwrap_or(Value::Null));
                    true
                } else {
                    false
                }
            } else {
                false
            }
        }
        _ => false,
    };
    if changed {
        notifier.notify();
    }
}

#[tauri::command]
pub fn library_snapshot(lib: tauri::State<'_, LibraryState>) -> Snapshot {
    let m = lib.mirror.lock().unwrap();
    Snapshot {
        artists: m.snapshot("artist"),
        albums: m.snapshot("album"),
        tracks: m.snapshot("track"),
        playlists: m.snapshot("playlist"),
    }
}

/// Force a resync (used after a local mutation the client made itself).
#[tauri::command]
pub fn library_resync(app: AppHandle, lib: tauri::State<'_, LibraryState>) {
    {
        let mut running = lib.running.lock().unwrap();
        if *running {
            return;
        }
        *running = true;
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = app2.state::<LibraryState>();
        if let Some(conn) = state.conn() {
            let notifier = app_notifier(&app2);
            let notify = || notifier.notify();
            if let Ok(Some(pruned)) = state.sync_once(&conn, &notify).await {
                log_art_prune(&app2, pruned);
            }
        }
        *state.running.lock().unwrap() = false;
    });
}

/// Cached album art (immutable per art id). Fetches once, then serves from disk.
#[tauri::command]
pub async fn library_art(
    lib: tauri::State<'_, LibraryState>,
    art_id: String,
    size: u32,
) -> Result<tauri::ipc::Response, String> {
    // Raw IPC response: the webview receives an ArrayBuffer instead of a JSON
    // number array, which cost 5-10x the bytes plus parse time per image.
    fetch_art(&lib, &art_id, size)
        .await
        .map(tauri::ipc::Response::new)
}

async fn fetch_art(lib: &LibraryState, art_id: &str, size: u32) -> Result<Vec<u8>, String> {
    let safe: String = art_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect();
    let path = lib.art_dir.join(format!("{safe}_{size}"));
    if let Ok(bytes) = std::fs::read(&path) {
        return Ok(bytes);
    }
    let conn = lib.conn().ok_or("library not configured")?;
    let key = format!("{safe}@{size}");
    {
        let mut negative = lib.art_negative.lock().unwrap();
        if negative
            .get(&key)
            .is_some_and(|expires| *expires > Instant::now())
        {
            return Err("art unavailable (cached)".into());
        }
        negative.remove(&key);
    }

    let (guard, waiter) = {
        let mut inflight = lib.art_inflight.lock().unwrap();
        if let Some(sender) = inflight.get(&key) {
            (None, Some(sender.subscribe()))
        } else {
            let (sender, _) = watch::channel(None);
            inflight.insert(key.clone(), sender.clone());
            (
                Some(ArtFetchGuard {
                    lib,
                    key: key.clone(),
                    sender,
                    finished: false,
                }),
                None,
            )
        }
    };
    if let Some(mut waiter) = waiter {
        loop {
            if let Some(result) = waiter.borrow().clone() {
                return result;
            }
            waiter
                .changed()
                .await
                .map_err(|_| "art fetch cancelled".to_string())?;
        }
    }
    let guard = guard.expect("winner path holds the in-flight guard");

    let result = async {
        let _permit = lib
            .art_fetches
            .acquire()
            .await
            .map_err(|_| "art fetch queue closed".to_string())?;
        let response = lib
            .http
            .get(format!(
                "{}/v1/art/{art_id}?w={size}&h={size}",
                conn.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&conn.token)
            .send()
            .await
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?;
        let bytes = response
            .bytes()
            .await
            .map_err(|error| error.to_string())?
            .to_vec();
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, &bytes).map_err(|error| error.to_string())?;
        std::fs::rename(&tmp, &path).map_err(|error| error.to_string())?;
        Ok(bytes)
    }
    .await;
    if result.is_err() {
        lib.art_negative
            .lock()
            .unwrap()
            .insert(key.clone(), Instant::now() + ART_NEGATIVE_TTL);
    }
    guard.finish(&result);
    result
}

/// Owns an in-flight art fetch. Dropping it without `finish` (the winning
/// future was cancelled) releases waiters with an error and clears the
/// in-flight key, so a cancelled winner can never strand later requests.
struct ArtFetchGuard<'a> {
    lib: &'a LibraryState,
    key: String,
    sender: watch::Sender<Option<ArtResult>>,
    finished: bool,
}

impl ArtFetchGuard<'_> {
    fn finish(mut self, result: &ArtResult) {
        let _ = self.sender.send(Some(result.clone()));
        self.finished = true;
    }
}

impl Drop for ArtFetchGuard<'_> {
    fn drop(&mut self) {
        if !self.finished {
            let _ = self
                .sender
                .send(Some(Err("art fetch cancelled".to_string())));
        }
        self.lib.art_inflight.lock().unwrap().remove(&self.key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::thread;

    fn mem() -> Mirror {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE entities (kind TEXT, id TEXT, json TEXT, PRIMARY KEY(kind,id));
             CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();
        Mirror { db }
    }

    fn test_state(path: &Path, base_url: String, concurrency: usize) -> LibraryState {
        LibraryState {
            mirror: Mutex::new(mem()),
            conn: Mutex::new(Some(Conn {
                base_url,
                token: "token".into(),
                identity: "local".into(),
            })),
            http: reqwest::Client::new(),
            art_dir: path.to_path_buf(),
            art_inflight: Mutex::new(HashMap::new()),
            art_negative: Mutex::new(HashMap::new()),
            art_fetches: Semaphore::new(concurrency),
            running: Mutex::new(false),
        }
    }

    #[test]
    fn upsert_delete_snapshot_roundtrip() {
        let m = mem();
        m.upsert("album", "alb_1", r#"{"albumId":"alb_1","title":"A"}"#);
        m.upsert("album", "alb_2", r#"{"albumId":"alb_2","title":"B"}"#);
        assert_eq!(m.snapshot("album").len(), 2);
        // Upsert replaces.
        m.upsert("album", "alb_1", r#"{"albumId":"alb_1","title":"A2"}"#);
        assert_eq!(m.snapshot("album").len(), 2);
        m.delete("album", "alb_2");
        let snap = m.snapshot("album");
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0]["title"], "A2");
    }

    #[test]
    fn structured_artist_credits_roundtrip_unchanged() {
        let m = mem();
        let track = serde_json::json!({
            "trackId": "trk_1",
            "primaryArtist": { "artistId": "art_1", "name": "Primary" },
            "artistCredits": [
                { "artistId": "art_1", "name": "Primary", "joinPhrase": " feat. " },
                { "artistId": "art_2", "name": "Credited Name", "joinPhrase": "" }
            ]
        });

        m.upsert("track", "trk_1", &track.to_string());

        assert_eq!(m.snapshot("track"), vec![track]);
    }

    #[test]
    fn delta_upsert_preserves_replaced_structured_artist_credits() {
        let m = mem();
        m.upsert(
            "track",
            "trk_1",
            &serde_json::json!({
                "trackId": "trk_1",
                "primaryArtist": { "artistId": "art_1", "name": "Primary" },
                "artistCredits": [{ "artistId": "art_1", "name": "Primary", "joinPhrase": "" }]
            })
            .to_string(),
        );
        let changed = serde_json::json!({
            "trackId": "trk_1",
            "primaryArtist": { "artistId": "art_1", "name": "Primary" },
            "artistCredits": [
                { "artistId": "art_1", "name": "Primary", "joinPhrase": " with " },
                { "artistId": "art_2", "name": "Guest", "joinPhrase": "" }
            ]
        });

        m.upsert("track", "trk_1", &changed.to_string());

        assert_eq!(m.snapshot("track"), vec![changed]);
    }

    #[test]
    fn version_and_wipe() {
        let m = mem();
        m.set_meta("version", "42");
        assert_eq!(m.version(), 42);
        m.upsert("track", "trk_1", r#"{"trackId":"trk_1"}"#);
        m.wipe();
        assert_eq!(m.version(), 0);
        assert_eq!(m.snapshot("track").len(), 0);
    }

    #[test]
    fn patch_love_updates_in_place() {
        let m = mem();
        m.upsert(
            "track",
            "trk_1",
            r#"{"trackId":"trk_1","loveState":"neutral"}"#,
        );
        m.patch_love("track", "trk_1", &serde_json::json!("loved"));
        assert_eq!(m.snapshot("track")[0]["loveState"], "loved");
    }

    #[test]
    fn stale_read_model_version_forces_metadata_bootstrap() {
        let m = mem();
        m.set_meta("identity", "local-engine");
        m.set_meta("version", "42");
        m.set_meta("read_model_version", "1");
        m.upsert("artist", "art_1", r#"{"artistId":"art_1"}"#);

        m.prepare("local-engine");

        assert_eq!(m.version(), 0);
        assert!(m.snapshot("artist").is_empty());
        assert_eq!(m.meta("identity").as_deref(), Some("local-engine"));
        assert_eq!(
            m.meta("read_model_version").as_deref(),
            Some(READ_MODEL_VERSION)
        );
    }

    #[test]
    fn bootstrap_pages_keep_old_rows_until_final_page_and_report_changes() {
        let m = mem();
        m.set_meta("version", "42");
        m.upsert("artist", "art_old", r#"{"artistId":"art_old"}"#);
        m.upsert("artist", "art_keep", r#"{"artistId":"art_keep"}"#);
        let first = vec![serde_json::json!({"artistId": "art_new"})];
        let second = vec![serde_json::json!({"artistId": "art_keep"})];
        let mut seen = HashSet::new();

        assert!(m
            .apply_bootstrap_page("artist", "artistId", &first, &mut seen, false)
            .unwrap());
        assert_eq!(m.snapshot("artist").len(), 3);
        assert!(m
            .apply_bootstrap_page("artist", "artistId", &second, &mut seen, true)
            .unwrap());
        let snapshot = m.snapshot("artist");
        assert_eq!(snapshot.len(), 2);
        assert!(snapshot.iter().any(|item| item["artistId"] == "art_new"));
        assert!(snapshot.iter().any(|item| item["artistId"] == "art_keep"));
        assert_eq!(m.version(), 42);

        let mut seen = HashSet::new();
        assert!(!m
            .apply_bootstrap_page("artist", "artistId", &first, &mut seen, false)
            .unwrap());
        assert!(!m
            .apply_bootstrap_page("artist", "artistId", &second, &mut seen, true)
            .unwrap());
    }

    #[test]
    fn version_regression_runs_full_bootstrap() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let requests = Arc::new(AtomicUsize::new(0));
        let request_count = Arc::clone(&requests);
        let server = thread::spawn(move || {
            for stream in listener.incoming().take(5) {
                let mut stream = stream.unwrap();
                let mut request = [0_u8; 2048];
                let len = stream.read(&mut request).unwrap();
                let request = String::from_utf8_lossy(&request[..len]);
                let path = request.split_whitespace().nth(1).unwrap();
                request_count.fetch_add(1, Ordering::SeqCst);
                let body = match path.split('?').next().unwrap() {
                    "/v1/library" => r#"{"version":1}"#,
                    "/v1/artists" => r#"{"items":[{"artistId":"art_new"}],"nextCursor":null}"#,
                    "/v1/albums" => r#"{"items":[],"nextCursor":null}"#,
                    "/v1/tracks" => r#"{"items":[],"nextCursor":null}"#,
                    "/v1/playlists" => "[]",
                    other => panic!("unexpected request: {other}"),
                };
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                )
                .unwrap();
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let state = LibraryState {
            mirror: Mutex::new(mem()),
            conn: Mutex::new(None),
            http: reqwest::Client::new(),
            art_dir: dir.path().to_path_buf(),
            art_inflight: Mutex::new(HashMap::new()),
            art_negative: Mutex::new(HashMap::new()),
            art_fetches: Semaphore::new(ART_FETCH_CONCURRENCY),
            running: Mutex::new(false),
        };
        state.mirror.lock().unwrap().set_meta("version", "9");
        state
            .mirror
            .lock()
            .unwrap()
            .upsert("artist", "art_old", r#"{"artistId":"art_old"}"#);
        let conn = Conn {
            base_url: format!("http://{address}"),
            token: "token".into(),
            identity: "local".into(),
        };

        tauri::async_runtime::block_on(state.sync_once(&conn, &|| {})).unwrap();
        server.join().unwrap();

        assert_eq!(requests.load(Ordering::SeqCst), 5);
        assert_eq!(state.mirror.lock().unwrap().version(), 1);
        assert_eq!(
            state.mirror.lock().unwrap().snapshot("artist"),
            vec![serde_json::json!({"artistId": "art_new"})]
        );
    }

    #[test]
    fn art_prune_removes_only_unreferenced_cache_files() {
        let m = mem();
        m.upsert(
            "album",
            "alb_1",
            r#"{"albumId":"alb_1","artId":"cover_keep"}"#,
        );
        let dir = tempfile::tempdir().unwrap();
        for name in [
            "cover_keep_300",
            "cover_stale_300",
            "cover_stale_large",
            "cover-stale_300",
            "cover_stale_300.tmp",
            "README",
        ] {
            std::fs::write(dir.path().join(name), name).unwrap();
        }

        assert_eq!(prune_art_cache(&m, dir.path()).unwrap(), 1);
        assert!(dir.path().join("cover_keep_300").exists());
        assert!(!dir.path().join("cover_stale_300").exists());
        assert!(dir.path().join("cover_stale_large").exists());
        assert!(dir.path().join("cover-stale_300").exists());
        assert!(dir.path().join("cover_stale_300.tmp").exists());
        assert!(dir.path().join("README").exists());
    }

    #[test]
    fn library_identity_supports_legacy_and_stable_ids() {
        assert_eq!(library_identity("local", "lib_local"), "local:lib_local");
        assert_eq!(
            library_identity("local", "lib_01JSTABLE"),
            "local:lib_01JSTABLE"
        );

        let mirror = mem();
        mirror.prepare(&library_identity("local", "lib_local"));
        mirror.upsert("track", "trk_1", r#"{"trackId":"trk_1"}"#);
        mirror.prepare(&library_identity("local", "lib_local"));
        assert_eq!(mirror.snapshot("track").len(), 1);
        mirror.prepare(&library_identity("local", "lib_01JSTABLE"));
        assert!(mirror.snapshot("track").is_empty());
    }

    #[test]
    fn rapid_notifications_are_trailing_edge_debounced() {
        let calls = Arc::new(AtomicUsize::new(0));
        let observed = Arc::clone(&calls);
        let debouncer = Arc::new(DebouncedNotifier::new(
            std::time::Duration::from_millis(40),
            move || {
                observed.fetch_add(1, Ordering::SeqCst);
            },
        ));

        tauri::async_runtime::block_on(async {
            for _ in 0..10 {
                debouncer.notify();
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            assert_eq!(calls.load(Ordering::SeqCst), 0);
            debouncer.notify();
            tokio::time::sleep(std::time::Duration::from_millis(60)).await;
        });

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn concurrent_art_waiters_share_failure_and_negative_cache() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let requests = Arc::new(AtomicUsize::new(0));
        let request_count = Arc::clone(&requests);
        let server = thread::spawn(move || {
            for stream in listener.incoming().take(2) {
                let mut stream = stream.unwrap();
                let mut request = [0_u8; 2048];
                stream.read(&mut request).unwrap();
                request_count.fetch_add(1, Ordering::SeqCst);
                thread::sleep(std::time::Duration::from_millis(50));
                write!(
                    stream,
                    "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                )
                .unwrap();
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let state = Arc::new(test_state(dir.path(), format!("http://{address}"), 6));

        tauri::async_runtime::block_on(async {
            let first = fetch_art(&state, "missing", 300);
            let second = fetch_art(&state, "missing", 300);
            let (a, b) = tokio::join!(first, second);
            assert!(a.is_err());
            assert!(b.is_err());
            assert!(fetch_art(&state, "missing", 300).await.is_err());
            state.art_negative.lock().unwrap().insert(
                "missing@300".into(),
                Instant::now() - Duration::from_secs(1),
            );
            assert!(fetch_art(&state, "missing", 300).await.is_err());
        });
        server.join().unwrap();
        assert_eq!(requests.load(Ordering::SeqCst), 2);

        state.invalidate_negative_art();
        assert!(state.art_negative.lock().unwrap().is_empty());
    }

    #[test]
    fn art_fetches_obey_global_concurrency_limit() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let server_active = Arc::clone(&active);
        let server_peak = Arc::clone(&peak);
        let server = thread::spawn(move || {
            let mut workers = Vec::new();
            for stream in listener.incoming().take(12) {
                let server_active = Arc::clone(&server_active);
                let server_peak = Arc::clone(&server_peak);
                workers.push(thread::spawn(move || {
                    let mut stream = stream.unwrap();
                    let mut request = [0_u8; 2048];
                    stream.read(&mut request).unwrap();
                    let now = server_active.fetch_add(1, Ordering::SeqCst) + 1;
                    server_peak.fetch_max(now, Ordering::SeqCst);
                    thread::sleep(std::time::Duration::from_millis(30));
                    server_active.fetch_sub(1, Ordering::SeqCst);
                    write!(
                        stream,
                        "HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\nx"
                    )
                    .unwrap();
                }));
            }
            for worker in workers {
                worker.join().unwrap();
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let state = Arc::new(test_state(dir.path(), format!("http://{address}"), 6));

        tauri::async_runtime::block_on(async {
            let tasks = (0..12)
                .map(|i| {
                    let state = Arc::clone(&state);
                    tauri::async_runtime::spawn(async move {
                        fetch_art(&state, &format!("art_{i}"), 300).await
                    })
                })
                .collect::<Vec<_>>();
            for task in tasks {
                assert!(task.await.unwrap().is_ok());
            }
        });
        server.join().unwrap();
        assert!(peak.load(Ordering::SeqCst) <= 6);
    }

    #[test]
    fn aborted_winner_releases_waiters_and_inflight_key() {
        // A server that accepts but never answers keeps the winning fetch
        // parked at its HTTP await point until the task is aborted.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        thread::spawn(move || {
            let mut held = Vec::new();
            for stream in listener.incoming() {
                held.push(stream);
            }
        });
        let dir = tempfile::tempdir().unwrap();
        let state = Arc::new(test_state(dir.path(), format!("http://{address}"), 6));

        tauri::async_runtime::block_on(async {
            let winner = {
                let state = Arc::clone(&state);
                tauri::async_runtime::spawn(async move {
                    let _ = fetch_art(&state, "img_wedge", 300).await;
                })
            };
            for _ in 0..200 {
                if state
                    .art_inflight
                    .lock()
                    .unwrap()
                    .contains_key("img_wedge@300")
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
            assert!(state
                .art_inflight
                .lock()
                .unwrap()
                .contains_key("img_wedge@300"));

            let waiter = {
                let state = Arc::clone(&state);
                tauri::async_runtime::spawn(
                    async move { fetch_art(&state, "img_wedge", 300).await },
                )
            };
            tokio::time::sleep(Duration::from_millis(50)).await;
            winner.abort();

            let outcome = tokio::time::timeout(Duration::from_secs(2), waiter)
                .await
                .expect("waiter must not hang after the winner is aborted");
            assert!(outcome.expect("waiter task must not panic").is_err());
            assert!(!state
                .art_inflight
                .lock()
                .unwrap()
                .contains_key("img_wedge@300"));
        });
    }
}
