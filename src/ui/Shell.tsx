import { listen } from "@tauri-apps/api/event";
import { Disc3, Mic2, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { Player } from "../audio/player";
import type { Connection } from "../state/connection";
import { NowPlayingBar } from "./NowPlayingBar";
import { Settings } from "./Settings";
import { AlbumsView } from "./views/AlbumsView";
import { AlbumView } from "./views/AlbumView";
import { ArtistsView } from "./views/ArtistsView";

export type View = { name: "albums" } | { name: "artists" } | { name: "album"; albumId: string };

export function Shell({
  connection,
  player,
  onConnectionChange,
}: {
  connection: Connection;
  player: Player;
  onConnectionChange: (c: Connection) => void;
}) {
  const [view, setView] = useState<View>({ name: "albums" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { client } = connection;

  // Preferences… (⌘,) from the native app menu.
  useEffect(() => {
    const unlisten = listen("menu:preferences", () => setSettingsOpen(true));
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="app-root">
      <div className="topbar" data-tauri-drag-region>
        <div className="topbar-logo brand">
          Blitter<span>Amp</span>
        </div>
        <div className="topbar-search">
          <input className="topbar-search-input" placeholder="Search (coming soon)" disabled />
        </div>
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title={connection.kind === "local" ? "This computer's library" : `Connected to ${connection.remoteUrl}`}
        >
          <SettingsIcon size={16} />
        </button>
      </div>
      <div className="app-body">
        <nav className="sidebar">
          <div className="nav-section">Library</div>
          <button
            type="button"
            className={`nav-item${view.name === "albums" || view.name === "album" ? " active" : ""}`}
            onClick={() => setView({ name: "albums" })}
          >
            <Disc3 size={14} />
            <span className="nav-label">Albums</span>
          </button>
          <button
            type="button"
            className={`nav-item${view.name === "artists" ? " active" : ""}`}
            onClick={() => setView({ name: "artists" })}
          >
            <Mic2 size={14} />
            <span className="nav-label">Artists</span>
          </button>
        </nav>
        <main className="content-area">
          {view.name === "albums" && (
            <AlbumsView
              client={client}
              managed={connection.kind === "local"}
              onOpen={(albumId) => setView({ name: "album", albumId })}
              onManage={() => setSettingsOpen(true)}
            />
          )}
          {view.name === "artists" && <ArtistsView client={client} />}
          {view.name === "album" && (
            <AlbumView client={client} player={player} albumId={view.albumId} onBack={() => setView({ name: "albums" })} />
          )}
        </main>
      </div>
      <NowPlayingBar client={client} player={player} />
      {settingsOpen && (
        <Settings
          connection={connection}
          onConnectionChange={(c) => {
            onConnectionChange(c);
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
