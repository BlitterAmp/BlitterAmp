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

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

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

    fn wipe_kind(&self, kind: &str) {
        let _ = self
            .db
            .execute("DELETE FROM entities WHERE kind = ?1", [kind]);
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

// ── the managed sync engine ─────────────────────────────────────

pub struct LibraryState {
    mirror: Mutex<Mirror>,
    conn: Mutex<Option<Conn>>,
    http: reqwest::Client,
    art_dir: PathBuf,
    art_inflight: Mutex<HashSet<String>>,
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
            art_inflight: Mutex::new(HashSet::new()),
            running: Mutex::new(false),
        }
    }

    fn conn(&self) -> Option<Conn> {
        self.conn.lock().unwrap().clone()
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
    ) -> Result<(), String> {
        {
            self.mirror.lock().unwrap().wipe_kind(kind);
        }
        let mut cursor = String::new();
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
            {
                let m = self.mirror.lock().unwrap();
                for it in &items {
                    if let Some(id) = it.get(id_field).and_then(|v| v.as_str()) {
                        m.upsert(kind, id, &it.to_string());
                    }
                }
            }
            match page.get("nextCursor").and_then(|v| v.as_str()) {
                Some(c) if !c.is_empty() => cursor = c.to_string(),
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
    ) -> Result<(), String> {
        let arr = self.get_json(conn, path).await?;
        let m = self.mirror.lock().unwrap();
        m.wipe_kind(kind);
        if let Some(items) = arr.as_array() {
            for it in items {
                if let Some(id) = it.get(id_field).and_then(|v| v.as_str()) {
                    m.upsert(kind, id, &it.to_string());
                }
            }
        }
        Ok(())
    }

    async fn bootstrap(&self, conn: &Conn) -> Result<(), String> {
        self.bootstrap_list(conn, "artist", "/v1/artists", "artistId")
            .await?;
        self.bootstrap_list(conn, "album", "/v1/albums", "albumId")
            .await?;
        self.bootstrap_list(conn, "track", "/v1/tracks", "trackId")
            .await?;
        self.bootstrap_bare(conn, "playlist", "/v1/playlists", "playlistId")
            .await?;
        let lib = self.get_json(conn, "/v1/library").await?;
        let version = lib.get("version").and_then(|v| v.as_i64()).unwrap_or(0);
        self.mirror
            .lock()
            .unwrap()
            .set_meta("version", &version.to_string());
        Ok(())
    }

    /// Pull /v1/changes from the mirror's version until drained.
    async fn delta(&self, conn: &Conn) -> Result<bool, String> {
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
            {
                let m = self.mirror.lock().unwrap();
                for (arr, kind, idf) in [
                    ("artists", "artist", "artistId"),
                    ("albums", "album", "albumId"),
                    ("tracks", "track", "trackId"),
                ] {
                    if let Some(items) = d.get(arr).and_then(|v| v.as_array()) {
                        for it in items {
                            if let Some(id) = it.get(idf).and_then(|v| v.as_str()) {
                                m.upsert(kind, id, &it.to_string());
                                changed = true;
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
                            m.delete(kind, id);
                            changed = true;
                        }
                    }
                }
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
    // A different server (or a switch local↔remote) means a different catalog —
    // wipe and re-bootstrap. Same identity keeps the mirror and only deltas.
    {
        let m = lib.mirror.lock().unwrap();
        if m.meta("identity").as_deref() != Some(identity.as_str()) {
            m.wipe();
            m.set_meta("identity", &identity);
        }
    }
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
    let version = lib.mirror.lock().unwrap().version();
    let result = if version == 0 {
        lib.bootstrap(&conn).await
    } else {
        lib.delta(&conn).await.map(|_| ())
    };
    if let Err(e) = result {
        crate::diagnostics::log(
            app,
            crate::diagnostics::Level::Error,
            crate::diagnostics::Source::Desktop,
            format!("library initial sync failed: {e}"),
        );
        return;
    }
    let _ = app.emit("library:changed", ());
    stream_events(app, lib, &conn).await;
}

/// SSE loop over /v1/events, reconnecting with Last-Event-ID.
async fn stream_events(app: &AppHandle, lib: &LibraryState, conn: &Conn) {
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
                handle_frame(app, lib, conn, &frame, &mut last_id).await;
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
        "library.changed" => lib.delta(conn).await.unwrap_or(false),
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
        let _ = app.emit("library:changed", ());
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
            let _ = state.delta(&conn).await;
            let _ = app2.emit("library:changed", ());
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
) -> Result<Vec<u8>, String> {
    let safe: String = art_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect();
    let path = lib.art_dir.join(format!("{safe}_{size}"));
    if let Ok(bytes) = std::fs::read(&path) {
        return Ok(bytes);
    }
    let conn = lib.conn().ok_or("library not configured")?;
    // Dedupe concurrent fetches of the same art.
    let ours = lib
        .art_inflight
        .lock()
        .unwrap()
        .insert(path.to_string_lossy().to_string());
    if !ours {
        for _ in 0..100 {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            if let Ok(bytes) = std::fs::read(&path) {
                return Ok(bytes);
            }
        }
    }
    let result = lib
        .http
        .get(format!(
            "{}/v1/art/{art_id}?w={size}&h={size}",
            conn.base_url.trim_end_matches('/')
        ))
        .bearer_auth(&conn.token)
        .send()
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r.error_for_status().map_err(|e| e.to_string()));
    lib.art_inflight
        .lock()
        .unwrap()
        .remove(&path.to_string_lossy().to_string());
    let bytes = result?.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Mirror {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE entities (kind TEXT, id TEXT, json TEXT, PRIMARY KEY(kind,id));
             CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);",
        )
        .unwrap();
        Mirror { db }
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
}
