use std::collections::VecDeque;
#[cfg(not(unix))]
use std::fs::File;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use chrono::{SecondsFormat, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const RING_LIMIT: usize = 5_000;
const INPUT_LIMIT: usize = 32 * 1024;
const MESSAGE_LIMIT: usize = 16 * 1024;
const FILE_LIMIT: u64 = 2 * 1024 * 1024;
const FILE_COUNT: usize = 3;
const LOG_NAME: &str = "combined.enc";
const LEGACY_LOG_NAME: &str = "combined.log";
const MAX_FRAME: usize = MESSAGE_LIMIT * 8;

static AUTH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(["']?authorization["']?\s*[:=]\s*["']?)(?:bearer|basic)\s+[^\s,"';}]+"#)
        .unwrap()
});
static COOKIE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(["']?(?:set[-_ ]?cookie|cookie)["']?\s*[:=]\s*)[^\r\n}]+"#).unwrap()
});
static SECRET: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?ix)(["']?(?:api[-_ ]?key|session[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|token|password|passwd|secret)["']?\s*[:=]\s*)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;&}]+)"#).unwrap()
});
static QUERY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)([?&](?:token|code|key|secret|grant|api(?:%2d|%5f|-|_)?key)=)[^&#\s]+")
        .unwrap()
});
static URL_CREDENTIALS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(https?://)[^/@\s:]+(?::[^/@\s]*)?@").unwrap());
static EMAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b").unwrap());
static IP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b|\[[0-9a-fA-F:]+\](?::\d+)?").unwrap()
});
static IDS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:prf|dev)_[A-Za-z0-9_-]+\b").unwrap());
static USER_PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(?:/Users/|/home/|[A-Z]:\\Users\\)[^/\\\s"']+(?:[/\\][^\s"']*)?"#).unwrap()
});

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Source {
    Desktop,
    Webview,
    ServerStdout,
    ServerStderr,
    ServerLifecycle,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub sequence: u64,
    pub timestamp_ms: i64,
    pub timestamp: String,
    pub level: Level,
    pub source: Source,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    records: Vec<Record>,
    epoch: u64,
    persistence: PersistenceStatus,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PersistenceStatus {
    enabled: bool,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Cleared {
    epoch: u64,
}

trait KeyProvider: Send + Sync {
    fn load_or_create(&self) -> Result<[u8; 32], ()>;
}

struct OsKeyProvider;
impl KeyProvider for OsKeyProvider {
    fn load_or_create(&self) -> Result<[u8; 32], ()> {
        let entry =
            keyring::Entry::new("com.blitteramp.desktop", "diagnostics-key").map_err(|_| ())?;
        match entry.get_secret() {
            Ok(secret) => secret.try_into().map_err(|_| ()),
            Err(keyring::Error::NoEntry) => {
                let key: [u8; 32] = rand::random();
                entry.set_secret(&key).map_err(|_| ())?;
                Ok(key)
            }
            Err(_) => Err(()),
        }
    }
}

struct Persistence {
    dir: PathBuf,
    cipher: Aes256Gcm,
}
struct Inner {
    records: VecDeque<Record>,
    next_sequence: u64,
    epoch: u64,
    persistence: Option<Persistence>,
    owned_dir: Option<PathBuf>,
    persistence_message: String,
}
pub struct Diagnostics {
    inner: Mutex<Inner>,
    home: Option<PathBuf>,
}

impl Diagnostics {
    pub fn new(dir: Result<PathBuf, ()>, home: Option<PathBuf>) -> Self {
        Self::with_provider(dir, home, Arc::new(OsKeyProvider))
    }

    fn with_provider(
        dir: Result<PathBuf, ()>,
        home: Option<PathBuf>,
        keys: Arc<dyn KeyProvider>,
    ) -> Self {
        let owned_dir = dir.ok().and_then(|dir| prepare_dir(&dir).ok().map(|_| dir));
        let persistence = owned_dir.clone().ok_or(()).and_then(|dir| {
            let key = keys.load_or_create()?;
            Ok(Persistence {
                dir,
                cipher: Aes256Gcm::new_from_slice(&key).map_err(|_| ())?,
            })
        });
        let (records, persistence, message) = match persistence {
            Ok(p) => match load_history(&p, RING_LIMIT) {
                Ok(records) => (records, Some(p), "Encrypted diagnostic history is enabled.".into()),
                Err(_) => (VecDeque::new(), None, "Diagnostic history is memory-only because encrypted history could not be opened.".into()),
            },
            Err(_) => (VecDeque::new(), None, "Diagnostic history is memory-only because secure storage is unavailable.".into()),
        };
        let next_sequence = records.back().map_or(1, |r| r.sequence.saturating_add(1));
        Self {
            inner: Mutex::new(Inner {
                records,
                next_sequence,
                epoch: 1,
                persistence,
                owned_dir,
                persistence_message: message,
            }),
            home,
        }
    }

    pub fn record(
        &self,
        app: Option<&AppHandle>,
        level: Level,
        source: Source,
        input: &str,
    ) -> Option<Record> {
        let message = redact(input, self.home.as_deref());
        // Dev builds mirror diagnostics to stderr so webview crashes are
        // debuggable from the terminal; release keeps the encrypted store only.
        #[cfg(debug_assertions)]
        eprintln!("[diag {level:?} {source:?}] {message}");
        if message.is_empty() {
            return None;
        }
        let now = Utc::now();
        let mut inner = self.inner.lock().ok()?;
        let record = Record {
            sequence: inner.next_sequence,
            timestamp_ms: now.timestamp_millis(),
            timestamp: now.to_rfc3339_opts(SecondsFormat::Millis, true),
            level,
            source,
            message,
        };
        inner.next_sequence = inner.next_sequence.saturating_add(1);
        if inner.records.len() == RING_LIMIT {
            inner.records.pop_front();
        }
        inner.records.push_back(record.clone());
        if let Some(persistence) = &inner.persistence {
            if append_record(persistence, &record, FILE_LIMIT, FILE_COUNT).is_err() {
                inner.persistence = None;
                inner.persistence_message =
                    "Diagnostic history switched to memory-only after a secure write failure."
                        .into();
            }
        }
        if let Some(app) = app {
            let _ = app.emit("diagnostics:record", &record);
        }
        Some(record)
    }

    fn snapshot(&self, limit: usize) -> Snapshot {
        let Ok(inner) = self.inner.lock() else {
            return Snapshot {
                records: vec![],
                epoch: 0,
                persistence: PersistenceStatus {
                    enabled: false,
                    message: "Diagnostics are unavailable.".into(),
                },
            };
        };
        let take = limit.clamp(1, RING_LIMIT).min(inner.records.len());
        Snapshot {
            records: inner
                .records
                .iter()
                .skip(inner.records.len() - take)
                .cloned()
                .collect(),
            epoch: inner.epoch,
            persistence: PersistenceStatus {
                enabled: inner.persistence.is_some(),
                message: inner.persistence_message.clone(),
            },
        }
    }

    fn clear(&self, app: &AppHandle) -> Result<(), String> {
        let epoch = self.clear_coordinated()?;
        app.emit("diagnostics:cleared", Cleared { epoch })
            .map_err(|_| "could not notify log viewers".into())
    }

    fn clear_coordinated(&self) -> Result<u64, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "diagnostic coordinator unavailable")?;
        if let Some(dir) = &inner.owned_dir {
            clear_files(dir, FILE_COUNT)
                .map_err(|_| "could not clear encrypted diagnostic files")?;
        }
        inner.records.clear();
        inner.epoch = inner.epoch.saturating_add(1);
        Ok(inner.epoch)
    }
}

pub fn log(app: &AppHandle, level: Level, source: Source, message: impl AsRef<str>) {
    app.state::<Diagnostics>()
        .record(Some(app), level, source, message.as_ref());
}

fn redact(input: &str, home: Option<&Path>) -> String {
    let mut value: String = input.chars().take(INPUT_LIMIT).collect();
    value = AUTH.replace_all(&value, "$1[REDACTED]").into_owned();
    value = COOKIE.replace_all(&value, "$1[REDACTED]").into_owned();
    value = SECRET.replace_all(&value, "$1[REDACTED]").into_owned();
    value = QUERY.replace_all(&value, "$1[REDACTED]").into_owned();
    value = URL_CREDENTIALS
        .replace_all(&value, "$1[REDACTED]@")
        .into_owned();
    value = EMAIL.replace_all(&value, "[REDACTED EMAIL]").into_owned();
    value = IP.replace_all(&value, "[REDACTED IP]").into_owned();
    value = IDS.replace_all(&value, "[REDACTED ID]").into_owned();
    if let Some(home) = home.and_then(Path::to_str).filter(|s| !s.is_empty()) {
        value = value.replace(home, "[REDACTED PATH]");
    }
    value = USER_PATH
        .replace_all(&value, "[REDACTED PATH]")
        .into_owned();
    truncate(&value, MESSAGE_LIMIT)
}

fn truncate(value: &str, max: usize) -> String {
    if value.len() <= max {
        return value.into();
    }
    let mut end = max.saturating_sub(12);
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{} [truncated]", &value[..end])
}
fn log_path(dir: &Path, index: usize) -> PathBuf {
    if index == 0 {
        dir.join(LOG_NAME)
    } else {
        dir.join(format!("{LOG_NAME}.{index}"))
    }
}

fn prepare_dir(dir: &Path) -> std::io::Result<()> {
    if dir.exists()
        && (!fs::symlink_metadata(dir)?.file_type().is_dir()
            || fs::symlink_metadata(dir)?.file_type().is_symlink())
    {
        return Err(std::io::ErrorKind::InvalidInput.into());
    }
    fs::create_dir_all(dir)?;
    for index in 0..FILE_COUNT {
        let path = if index == 0 {
            dir.join(LEGACY_LOG_NAME)
        } else {
            dir.join(format!("{LEGACY_LOG_NAME}.{index}"))
        };
        if checked_file(&path)?.is_some() {
            fs::remove_file(path)?;
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn checked_file(path: &Path) -> std::io::Result<Option<fs::Metadata>> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_file() && !meta.file_type().is_symlink() => Ok(Some(meta)),
        Ok(_) => Err(std::io::ErrorKind::InvalidInput.into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

fn encrypt(p: &Persistence, record: &Record) -> std::io::Result<Vec<u8>> {
    let plain = serde_json::to_vec(record).map_err(std::io::Error::other)?;
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::try_from(&nonce_bytes[..]).map_err(std::io::Error::other)?;
    let encrypted = p
        .cipher
        .encrypt(&nonce, plain.as_ref())
        .map_err(std::io::Error::other)?;
    let len = (nonce.len() + encrypted.len()) as u32;
    let mut frame = Vec::with_capacity(4 + len as usize);
    frame.extend_from_slice(&len.to_be_bytes());
    frame.extend_from_slice(&nonce_bytes);
    frame.extend_from_slice(&encrypted);
    Ok(frame)
}

fn append_record(p: &Persistence, record: &Record, max: u64, count: usize) -> std::io::Result<()> {
    let frame = encrypt(p, record)?;
    if frame.len() as u64 > max {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    let current = log_path(&p.dir, 0);
    let size = checked_file(&current)?.map_or(0, |m| m.len());
    if size > 0 && size + frame.len() as u64 > max {
        for index in (1..count).rev() {
            let from = log_path(&p.dir, index - 1);
            let to = log_path(&p.dir, index);
            if checked_file(&from)?.is_some() {
                if checked_file(&to)?.is_some() {
                    fs::remove_file(&to)?;
                }
                fs::rename(from, to)?;
            }
        }
    }
    checked_file(&current)?;
    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options
            .mode(0o600)
            .custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
    }
    let mut file = options.open(&current)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    file.write_all(&frame)
}

fn read_file(
    p: &Persistence,
    path: &Path,
    records: &mut VecDeque<Record>,
    limit: usize,
) -> std::io::Result<()> {
    if checked_file(path)?.is_none() {
        return Ok(());
    }
    #[cfg(unix)]
    let mut file = {
        use std::os::unix::fs::OpenOptionsExt;
        let file = OpenOptions::new()
            .read(true)
            .custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32)
            .open(path)?;
        if !file.metadata()?.is_file() {
            return Err(std::io::ErrorKind::InvalidInput.into());
        }
        file
    };
    #[cfg(not(unix))]
    let mut file = {
        let file = File::open(path)?;
        if !file.metadata()?.is_file() {
            return Err(std::io::ErrorKind::InvalidInput.into());
        }
        file
    };
    loop {
        let mut len = [0; 4];
        match file.read_exact(&mut len) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e),
        };
        let len = u32::from_be_bytes(len) as usize;
        if !(13..=MAX_FRAME).contains(&len) {
            return Err(std::io::ErrorKind::InvalidData.into());
        }
        let mut data = vec![0; len];
        file.read_exact(&mut data)?;
        let nonce = Nonce::try_from(&data[..12]).map_err(std::io::Error::other)?;
        let plain = p
            .cipher
            .decrypt(&nonce, &data[12..])
            .map_err(std::io::Error::other)?;
        let record = serde_json::from_slice(&plain).map_err(std::io::Error::other)?;
        if records.len() == limit {
            records.pop_front();
        }
        records.push_back(record);
    }
    Ok(())
}

fn load_history(p: &Persistence, limit: usize) -> std::io::Result<VecDeque<Record>> {
    let mut records = VecDeque::new();
    for index in (0..FILE_COUNT).rev() {
        read_file(p, &log_path(&p.dir, index), &mut records, limit)?;
    }
    Ok(records)
}
fn clear_files(dir: &Path, count: usize) -> std::io::Result<()> {
    for index in 0..count {
        for path in [
            log_path(dir, index),
            if index == 0 {
                dir.join(LEGACY_LOG_NAME)
            } else {
                dir.join(format!("{LEGACY_LOG_NAME}.{index}"))
            },
        ] {
            if checked_file(&path)?.is_some() {
                fs::remove_file(path)?;
            }
        }
    }
    Ok(())
}

pub struct StreamFramer {
    bytes: Vec<u8>,
    discarding: bool,
}
impl StreamFramer {
    pub fn new() -> Self {
        Self {
            bytes: Vec::new(),
            discarding: false,
        }
    }
    pub fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.bytes.extend_from_slice(chunk);
        let mut out = Vec::new();
        if self.discarding {
            let Some(pos) = self.bytes.iter().position(|b| *b == b'\n' || *b == b'\r') else {
                self.bytes.clear();
                return out;
            };
            let delimiter = self.bytes[pos];
            self.bytes.drain(..=pos);
            if delimiter == b'\r' && self.bytes.first() == Some(&b'\n') {
                self.bytes.remove(0);
            }
            self.discarding = false;
        }
        while let Some(pos) = self.bytes.iter().position(|b| *b == b'\n' || *b == b'\r') {
            if pos > INPUT_LIMIT {
                let line = String::from_utf8_lossy(&self.bytes[..INPUT_LIMIT]);
                out.push(format!("{line} [unterminated line truncated]"));
                let delimiter = self.bytes[pos];
                self.bytes.drain(..=pos);
                if delimiter == b'\r' && self.bytes.first() == Some(&b'\n') {
                    self.bytes.remove(0);
                }
                continue;
            }
            let line: Vec<_> = self.bytes.drain(..pos).collect();
            let delimiter = self.bytes.remove(0);
            if delimiter == b'\r' && self.bytes.first() == Some(&b'\n') {
                self.bytes.remove(0);
            }
            if !line.is_empty() {
                out.push(String::from_utf8_lossy(&line).into_owned());
            }
        }
        if self.bytes.len() > INPUT_LIMIT {
            let line: Vec<_> = self.bytes.drain(..INPUT_LIMIT).collect();
            out.push(format!(
                "{} [unterminated line truncated]",
                String::from_utf8_lossy(&line)
            ));
            self.bytes.clear();
            self.discarding = true;
        }
        out
    }
    pub fn flush(&mut self) -> Option<String> {
        if self.discarding {
            self.bytes.clear();
            self.discarding = false;
            None
        } else if self.bytes.is_empty() {
            None
        } else {
            Some(String::from_utf8_lossy(std::mem::take(&mut self.bytes).as_slice()).into_owned())
        }
    }
}

pub fn parse_server_line(line: &str, fallback: Level) -> (Level, String) {
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
        let level = value
            .get("level")
            .and_then(|v| v.as_str())
            .and_then(parse_level)
            .unwrap_or(fallback);
        if let Some(message) = value
            .get("msg")
            .or_else(|| value.get("message"))
            .and_then(|v| v.as_str())
        {
            return (level, message.into());
        }
    }
    let lower = line.to_ascii_lowercase();
    let level = [Level::Error, Level::Warn, Level::Debug, Level::Info]
        .into_iter()
        .find(|l| {
            lower.contains(match l {
                Level::Error => "level=error",
                Level::Warn => "level=warn",
                Level::Debug => "level=debug",
                Level::Info => "level=info",
            })
        })
        .unwrap_or(fallback);
    (level, line.into())
}
fn parse_level(value: &str) -> Option<Level> {
    match value.to_ascii_lowercase().as_str() {
        "debug" => Some(Level::Debug),
        "info" => Some(Level::Info),
        "warn" | "warning" => Some(Level::Warn),
        "error" => Some(Level::Error),
        _ => None,
    }
}

#[derive(Deserialize)]
pub struct FrontendLog {
    level: Level,
    message: String,
    stack: Option<String>,
    location: Option<String>,
}
#[tauri::command]
pub fn frontend_log(
    app: AppHandle,
    state: State<'_, Diagnostics>,
    entry: FrontendLog,
) -> Result<(), String> {
    if entry.message.trim().is_empty() || entry.message.len() > INPUT_LIMIT {
        return Err("invalid diagnostic message".into());
    }
    let mut message = entry.message;
    if let Some(location) = entry.location.filter(|s| !s.trim().is_empty()) {
        message.push_str("\nlocation: ");
        message.push_str(&truncate(&location, 1024));
    }
    if let Some(stack) = entry.stack.filter(|s| !s.trim().is_empty()) {
        message.push('\n');
        message.push_str(&truncate(&stack, 8192));
    }
    state.record(Some(&app), entry.level, Source::Webview, &message);
    Ok(())
}
#[tauri::command]
pub fn diagnostics_snapshot(state: State<'_, Diagnostics>, limit: Option<usize>) -> Snapshot {
    state.snapshot(limit.unwrap_or(RING_LIMIT))
}
#[tauri::command]
pub fn diagnostics_clear(app: AppHandle, state: State<'_, Diagnostics>) -> Result<(), String> {
    state.clear(&app)
}
#[tauri::command]
pub fn diagnostics_open_folder(
    app: AppHandle,
    state: State<'_, Diagnostics>,
) -> Result<(), String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "diagnostic coordinator unavailable")?;
    let dir = inner
        .owned_dir
        .clone()
        .ok_or("diagnostic log folder is unavailable")?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|_| "could not open diagnostic folder".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct KeyResult(Result<[u8; 32], ()>);
    impl KeyProvider for KeyResult {
        fn load_or_create(&self) -> Result<[u8; 32], ()> {
            self.0
        }
    }
    fn test_dir() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }
    fn diag(dir: PathBuf, key: [u8; 32]) -> Diagnostics {
        Diagnostics::with_provider(Ok(dir), None, Arc::new(KeyResult(Ok(key))))
    }
    #[test]
    fn redacts_secrets_and_pii_variants() {
        let got = redact(
            r#"{"Authorization":"Basic abc","apiKey":"xyz"} https://user:pass@host/x?code=a%2Fb person@example.test 192.0.2.4 prf_abc /home/test/Music"#,
            None,
        );
        for secret in [
            "abc",
            "xyz",
            "user",
            "pass",
            "a%2Fb",
            "person@example.test",
            "192.0.2.4",
            "prf_abc",
            "/home/test",
        ] {
            assert!(!got.contains(secret), "leaked {secret}: {got}");
        }
    }
    #[test]
    fn preserves_status() {
        assert_eq!(
            redact("scan complete: 42 tracks", None),
            "scan complete: 42 tracks"
        );
    }
    #[test]
    fn framing_handles_fragments_utf8_lines_and_partial() {
        let mut f = StreamFramer::new();
        assert!(f.push(b"token=sec").is_empty());
        let lines = f.push(b"ret\r\nnext\nthird");
        assert_eq!(lines.len(), 2);
        assert!(!redact(&lines[0], None).contains("secret"));
        assert_eq!(f.flush().unwrap(), "third");
        let mut f = StreamFramer::new();
        assert!(f.push(&[0xe2]).is_empty());
        assert_eq!(f.push(&[0x98, 0x83, b'\n'])[0], "☃");
        let mut f = StreamFramer::new();
        assert!(f.push(&[0xff, b'\n'])[0].contains('�'));
    }
    #[test]
    fn oversized_framing_discards_suffix_then_resumes() {
        let mut framer = StreamFramer::new();
        assert_eq!(framer.push(&vec![b'x'; INPUT_LIMIT + 1]).len(), 1);
        assert!(framer.push(b"token=leaked-suffix").is_empty());
        let lines = framer.push(b"\ntoken=synthetic-secret\nnormal\n");
        assert_eq!(lines.len(), 2);
        assert!(!redact(&lines[0], None).contains("synthetic-secret"));
        assert_eq!(lines[1], "normal");
    }
    #[test]
    fn parses_json_and_text_levels() {
        assert_eq!(
            parse_server_line(r#"{"level":"error","msg":"failed"}"#, Level::Info),
            (Level::Error, "failed".into())
        );
        assert_eq!(
            parse_server_line("time=x level=warn msg=slow", Level::Info).0,
            Level::Warn
        );
    }
    #[test]
    fn crypto_roundtrip_and_no_plaintext() {
        let temp = test_dir();
        let dir = temp.path().to_path_buf();
        let d = diag(dir.clone(), [7; 32]);
        d.record(
            None,
            Level::Info,
            Source::Desktop,
            "synthetic secretless marker",
        );
        let bytes = fs::read(log_path(&dir, 0)).unwrap();
        assert!(!bytes.windows(10).any(|w| w == b"secretless"));
        let d2 = diag(dir, [7; 32]);
        assert_eq!(
            d2.snapshot(10).records[0].message,
            "synthetic secretless marker"
        );
    }
    #[test]
    fn wrong_or_missing_key_is_memory_only() {
        let temp = test_dir();
        let dir = temp.path().to_path_buf();
        let d = diag(dir.clone(), [1; 32]);
        d.record(None, Level::Info, Source::Desktop, "one");
        let wrong = diag(dir, [2; 32]);
        assert!(!wrong.snapshot(10).persistence.enabled);
        let missing_dir = test_dir();
        let missing = Diagnostics::with_provider(
            Ok(missing_dir.path().to_path_buf()),
            None,
            Arc::new(KeyResult(Err(()))),
        );
        assert!(!missing.snapshot(10).persistence.enabled);
    }
    #[test]
    fn clear_recovers_without_an_active_cipher() {
        for mode in 0..3 {
            let temp = test_dir();
            let dir = temp.path().to_path_buf();
            let original = diag(dir.clone(), [1; 32]);
            original.record(None, Level::Info, Source::Desktop, "record");
            if mode == 0 {
                fs::write(log_path(&dir, 0), b"corrupt").unwrap();
            }
            let unavailable = if mode == 2 {
                Diagnostics::with_provider(Ok(dir.clone()), None, Arc::new(KeyResult(Err(()))))
            } else {
                diag(dir.clone(), [2; 32])
            };
            assert!(!unavailable.snapshot(10).persistence.enabled);
            assert_eq!(unavailable.clear_coordinated().unwrap(), 2);
            assert!(!log_path(&dir, 0).exists());
            assert!(diag(dir, [1; 32]).snapshot(10).persistence.enabled);
        }
    }
    #[test]
    fn concurrent_writers_are_ordered_and_bounded() {
        let temp = test_dir();
        let d = Arc::new(diag(temp.path().to_path_buf(), [3; 32]));
        let mut threads = vec![];
        for _ in 0..8 {
            let d = d.clone();
            threads.push(std::thread::spawn(move || {
                for _ in 0..100 {
                    d.record(None, Level::Info, Source::Desktop, "line");
                }
            }));
        }
        for t in threads {
            t.join().unwrap();
        }
        let s = d.snapshot(5000);
        assert_eq!(s.records.len(), 800);
        assert!(s.records.windows(2).all(|w| w[0].sequence < w[1].sequence));
    }
    #[test]
    fn rotation_replaces_destinations_and_honors_count() {
        let temp = test_dir();
        let dir = temp.path().to_path_buf();
        prepare_dir(&dir).unwrap();
        let p = Persistence {
            dir: dir.clone(),
            cipher: Aes256Gcm::new_from_slice(&[9; 32]).unwrap(),
        };
        let r = Record {
            sequence: 1,
            timestamp_ms: 1,
            timestamp: "x".into(),
            level: Level::Info,
            source: Source::Desktop,
            message: "line".into(),
        };
        let size = encrypt(&p, &r).unwrap().len() as u64;
        for _ in 0..8 {
            append_record(&p, &r, size, 3).unwrap();
        }
        assert!(log_path(&dir, 2).is_file());
        assert!(!log_path(&dir, 3).exists());
        assert!(fs::metadata(log_path(&dir, 0)).unwrap().len() <= size);
    }
    #[cfg(unix)]
    #[test]
    fn private_permissions_and_symlink_rejection() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let temp = test_dir();
        let dir = temp.path().to_path_buf();
        let d = diag(dir.clone(), [4; 32]);
        d.record(None, Level::Info, Source::Desktop, "line");
        assert_eq!(
            fs::metadata(&dir).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(log_path(&dir, 0))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        let bad_temp = test_dir();
        let bad = bad_temp.path().to_path_buf();
        fs::create_dir_all(&bad).unwrap();
        symlink("target", log_path(&bad, 0)).unwrap();
        let d = diag(bad, [5; 32]);
        d.record(None, Level::Info, Source::Desktop, "line");
        assert!(!d.snapshot(1).persistence.enabled);
    }
}
