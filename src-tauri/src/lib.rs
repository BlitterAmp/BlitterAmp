mod engine;

use engine::EngineState;

// BlitterAmp's Rust host: window/plugin lifecycle plus the bundled
// BlitterServer engine manager (engine.rs). Player logic lives in the
// webview; music logic lives in BlitterServer.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineState::default())
        .invoke_handler(tauri::generate_handler![
            engine::engine_start,
            engine::engine_stop,
            engine::engine_set_source
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                use tauri::Manager;
                let state = window.state::<EngineState>();
                engine::engine_stop(state);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
