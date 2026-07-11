import { Disc3, LogOut, Mic2 } from "lucide-react";
import { useState } from "react";
import type { Client } from "../api/client";
import type { Player } from "../audio/player";
import { clearSession } from "../state/session";
import { NowPlayingBar } from "./NowPlayingBar";
import { AlbumsView } from "./views/AlbumsView";
import { AlbumView } from "./views/AlbumView";
import { ArtistsView } from "./views/ArtistsView";

export type View =
  | { name: "albums" }
  | { name: "artists" }
  | { name: "album"; albumId: string };

export function Shell({
  client,
  player,
  profileName,
  managed,
  onSignOut,
}: {
  client: Client;
  player: Player;
  profileName: string;
  managed: boolean;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<View>({ name: "albums" });

  async function signOut() {
    await clearSession();
    onSignOut();
  }

  return (
    <div className="app-root">
      <div className="topbar">
        <div className="topbar-logo brand">
          Blitter<span>Amp</span>
        </div>
        <div className="topbar-search">
          <input className="topbar-search-input" placeholder="Search (coming soon)" disabled />
        </div>
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
          <div style={{ marginTop: "auto" }}>
            <button type="button" className="nav-item" onClick={() => void signOut()}>
              <LogOut size={14} />
              <span className="nav-label">{profileName} — sign out</span>
            </button>
          </div>
        </nav>
        <main className="content-area">
          {view.name === "albums" && (
            <AlbumsView
              client={client}
              managed={managed}
              onOpen={(albumId) => setView({ name: "album", albumId })}
            />
          )}
          {view.name === "artists" && <ArtistsView client={client} />}
          {view.name === "album" && (
            <AlbumView
              client={client}
              player={player}
              albumId={view.albumId}
              onBack={() => setView({ name: "albums" })}
            />
          )}
        </main>
      </div>
      <NowPlayingBar client={client} player={player} />
    </div>
  );
}
