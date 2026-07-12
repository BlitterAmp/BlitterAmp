//! Native application menu. The main reason it's custom (rather than Tauri's
//! default) is the macOS-standard Preferences… (⌘,) item, which opens the
//! in-app Settings by emitting `menu:preferences` to the webview. The Edit
//! submenu is kept so copy/paste/select-all work in Settings' text fields.

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

pub const PREFERENCES: &str = "preferences";
pub const ABOUT: &str = "about";

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Our own About item (rather than the predefined native panel) so it opens
    // the in-app About window with the full acknowledgements list.
    let about = MenuItemBuilder::with_id(ABOUT, "About BlitterAmp").build(app)?;
    let preferences = MenuItemBuilder::with_id(PREFERENCES, "Preferences…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_menu = SubmenuBuilder::new(app, "BlitterAmp")
        .item(&about)
        .separator()
        .item(&preferences)
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .fullscreen()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &window_menu])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

/// Routes menu clicks to the webview: Preferences opens Settings, About opens
/// the About window.
pub fn on_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        PREFERENCES => {
            let _ = app.emit("menu:preferences", ());
        }
        ABOUT => {
            let _ = app.emit("menu:about", ());
        }
        _ => {}
    }
}
