// BlitterAmp's Rust host stays deliberately thin: window lifecycle and
// plugins (store for session persistence, http so the webview can talk to an
// arbitrary self-hosted BlitterServer without CORS). Player logic lives in
// the webview; the mpv and embedded-engine sidecars arrive in later arcs.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
