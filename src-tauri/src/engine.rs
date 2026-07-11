//! Manages a bundled BlitterServer as a child process ("the engine"), so a
//! fresh install is a zero-setup local music player. All admin-cookie
//! provisioning lives here — the webview can't read Set-Cookie reliably, so
//! Rust owns the admin session and the app only ever sees the bearer profile
//! token this returns.

use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use rand::Rng;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Handle to the running engine child, killed on app exit.
#[derive(Default)]
pub struct EngineState(pub Mutex<Option<CommandChild>>);

/// What the app needs to talk to the engine after it's provisioned.
#[derive(Serialize, Clone)]
pub struct EngineInfo {
    pub base_url: String,
    pub profile_token: String,
    pub profile_name: String,
}

/// Persisted between launches (admin password lets us reconfigure the engine;
/// the profile token is the app's working credential).
#[derive(Serialize, Deserialize, Default)]
struct EngineFile {
    admin_password: String,
    profile_token: String,
    profile_name: String,
}

fn engine_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?
        .join("engine");
    std::fs::create_dir_all(&dir).map_err(|e| format!("create engine dir: {e}"))?;
    Ok(dir)
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(engine_dir(app)?.join("desktop-engine.json"))
}

fn read_state(app: &AppHandle) -> EngineFile {
    state_path(app)
        .ok()
        .and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn write_state(app: &AppHandle, s: &EngineFile) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(state_path(app)?, bytes).map_err(|e| format!("write engine state: {e}"))
}

fn free_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("pick port: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    Ok(port) // dropped here; a brief TOCTOU window is fine on loopback
}

fn random_password() -> String {
    let mut rng = rand::rng();
    (0..40)
        .map(|_| {
            let c = rng.random_range(0..62u8);
            match c {
                0..=9 => (b'0' + c) as char,
                10..=35 => (b'a' + c - 10) as char,
                _ => (b'A' + c - 36) as char,
            }
        })
        .collect()
}

/// Spawns the sidecar, waits until it answers, and provisions it on first run.
/// Idempotent: on later launches it restarts the process and reuses (or
/// re-mints) the profile token.
#[tauri::command]
pub async fn engine_start(app: AppHandle, state: State<'_, EngineState>) -> Result<EngineInfo, String> {
    // A previously spawned child (e.g. after a soft reload) is replaced.
    if let Some(child) = state.0.lock().unwrap().take() {
        let _ = child.kill();
    }

    let dir = engine_dir(&app)?;
    let port = free_loopback_port()?;
    let base = format!("http://127.0.0.1:{port}");

    let (_rx, child) = app
        .shell()
        .sidecar("blitterserver")
        .map_err(|e| format!("sidecar: {e}"))?
        .args(["--listen", &format!("127.0.0.1:{port}"), "--data-dir", &dir.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("spawn engine: {e}"))?;
    eprintln!("[engine] started on 127.0.0.1:{port} (data dir: {})", dir.display());
    *state.0.lock().unwrap() = Some(child);

    let http = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;

    wait_ready(&http, &base).await?;
    let info = provision(&app, &http, &base)
        .await
        .map_err(|e| {
            eprintln!("[engine] provisioning failed: {e}");
            e
        })?;
    Ok(info)
}

/// Stops the engine (called on app exit).
#[tauri::command]
pub fn engine_stop(state: State<'_, EngineState>) {
    if let Some(child) = state.0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

#[derive(Deserialize)]
struct Ping {
    name: String,
    #[serde(rename = "setupComplete")]
    setup_complete: Option<bool>,
}

async fn wait_ready(http: &reqwest::Client, base: &str) -> Result<(), String> {
    for _ in 0..100 {
        if let Ok(resp) = http.get(format!("{base}/v1/ping")).send().await {
            if let Ok(ping) = resp.json::<Ping>().await {
                if ping.name == "BlitterServer" {
                    return Ok(());
                }
            }
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err("engine did not become ready".into())
}

async fn provision(app: &AppHandle, http: &reqwest::Client, base: &str) -> Result<EngineInfo, String> {
    let mut file = read_state(app);

    let ping: Ping = http
        .get(format!("{base}/v1/ping"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Fresh data dir: set the admin password (ours to keep).
    if ping.setup_complete != Some(true) {
        file.admin_password = random_password();
        post(http, base, "/admin/api/setup", &serde_json::json!({ "password": file.admin_password }))
            .await?;
        file.profile_token.clear(); // must re-mint against the new instance
    }
    if file.admin_password.is_empty() {
        return Err("engine is set up but the desktop lost its admin password".into());
    }

    // An existing profile token that still validates means we're done.
    if !file.profile_token.is_empty() {
        let ok = http
            .get(format!("{base}/v1/me"))
            .bearer_auth(&file.profile_token)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        if ok {
            return Ok(EngineInfo {
                base_url: base.to_string(),
                profile_token: file.profile_token,
                profile_name: file.profile_name,
            });
        }
    }

    // Log in and mint a fresh profile token via the proven pairing recipe.
    post(http, base, "/admin/api/session", &serde_json::json!({ "password": file.admin_password }))
        .await?;
    put(http, base, "/admin/api/settings/server", &serde_json::json!({ "canonicalUrl": base })).await?;

    // Reuse the "Me" profile if provisioning ran before, else create it.
    let profiles: serde_json::Value =
        get_json(http, base, "/admin/api/profiles").await?;
    let (profile_id, profile_name) = match profiles.as_array().and_then(|a| a.first()) {
        Some(p) => (
            p["profileId"].as_str().unwrap_or_default().to_string(),
            p["name"].as_str().unwrap_or("Me").to_string(),
        ),
        None => {
            let created: serde_json::Value =
                post_json(http, base, "/admin/api/profiles", &serde_json::json!({ "name": "Me" })).await?;
            (
                created["profileId"].as_str().unwrap_or_default().to_string(),
                "Me".to_string(),
            )
        }
    };

    let code: serde_json::Value = post_json(http, base, "/admin/api/pair-codes", &serde_json::json!({})).await?;
    let code = code["code"].as_str().ok_or("no pair code")?;

    let claim: serde_json::Value = post_json(
        http,
        base,
        "/v1/pair/claim",
        &serde_json::json!({ "code": code, "deviceName": "BlitterAmp (this device)", "deviceType": "desktop" }),
    )
    .await?;
    let device_token = claim["token"].as_str().ok_or("no device token")?;

    let minted = http
        .post(format!("{base}/v1/profile-tokens"))
        .bearer_auth(device_token)
        .json(&serde_json::json!({ "profileId": profile_id }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !minted.status().is_success() {
        return Err(format!("mint profile token: {}", minted.status()));
    }
    let minted: serde_json::Value = minted.json().await.map_err(|e| e.to_string())?;
    let profile_token = minted["token"].as_str().ok_or("no profile token")?.to_string();

    file.profile_token = profile_token.clone();
    file.profile_name = profile_name.clone();
    write_state(app, &file)?;

    Ok(EngineInfo {
        base_url: base.to_string(),
        profile_token,
        profile_name,
    })
}

/// Points the engine at a music directory and kicks off a scan. Uses the
/// stored admin password (source config is admin-cookie-gated).
#[tauri::command]
pub async fn engine_set_source(app: AppHandle, base_url: String, path: String) -> Result<(), String> {
    engine_admin(app, base_url, "PUT".into(), "/admin/api/source/filesystem".into(), Some(serde_json::json!({ "path": path }))).await?;
    Ok(())
}

/// Forwards an admin API call to the managed engine, authenticated with the
/// stored admin password. This is how native Settings manages the local
/// library — the desktop app IS the admin of its bundled engine (a remote
/// server the user pairs to is managed in that server's own web console).
/// Returns the parsed JSON body, or Null for 204/empty responses.
#[tauri::command]
pub async fn engine_admin(
    app: AppHandle,
    base_url: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let file = read_state(&app);
    if file.admin_password.is_empty() {
        return Err("no managed engine to administer".into());
    }
    let http = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;
    post(&http, &base_url, "/admin/api/session", &serde_json::json!({ "password": file.admin_password })).await?;

    let url = format!("{base_url}{path}");
    let mut req = match method.as_str() {
        "GET" => http.get(url),
        "POST" => http.post(url),
        "PUT" => http.put(url),
        "PATCH" => http.patch(url),
        "DELETE" => http.delete(url),
        other => return Err(format!("unsupported method {other}")),
    };
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        // Surface the server's problem code when present.
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(code) = v.get("code").and_then(|c| c.as_str()) {
                return Err(format!("{path}: {status} ({code})"));
            }
        }
        return Err(format!("{path}: {status}"));
    }
    if text.is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

// ---- small HTTP helpers: any non-2xx is an error ----

async fn post(http: &reqwest::Client, base: &str, path: &str, body: &serde_json::Value) -> Result<(), String> {
    let resp = http.post(format!("{base}{path}")).json(body).send().await.map_err(|e| e.to_string())?;
    status_ok(path, resp.status())
}

async fn put(http: &reqwest::Client, base: &str, path: &str, body: &serde_json::Value) -> Result<(), String> {
    let resp = http.put(format!("{base}{path}")).json(body).send().await.map_err(|e| e.to_string())?;
    status_ok(path, resp.status())
}

async fn post_json(http: &reqwest::Client, base: &str, path: &str, body: &serde_json::Value) -> Result<serde_json::Value, String> {
    let resp = http.post(format!("{base}{path}")).json(body).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    status_ok(path, status)?;
    Ok(value)
}

async fn get_json(http: &reqwest::Client, base: &str, path: &str) -> Result<serde_json::Value, String> {
    let resp = http.get(format!("{base}{path}")).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    status_ok(path, status)?;
    Ok(value)
}

fn status_ok(path: &str, status: reqwest::StatusCode) -> Result<(), String> {
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("{path}: {status}"))
    }
}
