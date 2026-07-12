mod audio;
mod diagnostics;
mod engine;
mod library;
mod lru;
mod menu;

use audio::AudioEngine;
use engine::EngineState;
use library::LibraryState;
use tauri::Manager;

// BlitterAmp's Rust host: window/plugin lifecycle, the native app menu, and
// the bundled BlitterServer engine manager (engine.rs). Player logic lives in
// the webview; music logic lives in BlitterServer.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(EngineState::default())
        .invoke_handler(tauri::generate_handler![
            engine::engine_start,
            engine::engine_stop,
            engine::engine_set_source,
            engine::engine_admin,
            audio::audio_configure,
            audio::audio_play_track,
            audio::audio_stage_next,
            audio::audio_preload,
            audio::audio_pause,
            audio::audio_resume,
            audio::audio_seek,
            audio::audio_set_volume,
            audio::audio_stop,
            library::library_configure,
            library::library_snapshot,
            library::library_resync,
            library::library_art,
            diagnostics::frontend_log,
            diagnostics::diagnostics_snapshot,
            diagnostics::diagnostics_clear,
            diagnostics::diagnostics_open_folder
        ])
        .setup(|app| {
            let log_dir = app.path().app_log_dir().map_err(|_| ());
            let home = app.path().home_dir().ok();
            app.manage(diagnostics::Diagnostics::new(log_dir, home));
            menu::build(app.handle())?;
            app.manage(AudioEngine::new(app.handle()));
            app.manage(LibraryState::new(app.handle()));
            Ok(())
        })
        .on_menu_event(|app, event| menu::on_event(app, event.id().as_ref()))
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
