import { listen } from "@tauri-apps/api/event";
import { Disc3, ListMusic, Mic2, Music, Plus, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { Player } from "../audio/player";
import type { Connection } from "../state/connection";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueueDrawer } from "./QueueDrawer";
import { PlaylistsProvider, usePlaylists } from "../state/playlists";
import { PlaylistView } from "./views/PlaylistView";
import { Settings } from "./Settings";
import { AlbumsView } from "./views/AlbumsView";
import { AlbumView } from "./views/AlbumView";
import { ArtistsView } from "./views/ArtistsView";
import { ArtistView } from "./views/ArtistView";
import { TracksView } from "./views/TracksView";
import type { NavTarget } from "./TrackList";

export type View =
  | { name: "albums" }
  | { name: "artists" }
  | { name: "tracks" }
  | { name: "album"; albumId: string }
  | { name: "artist"; artistId: string }
  | { name: "playlist"; playlistId: string };

export function Shell(props: { connection: Connection; player: Player; onConnectionChange: (c: Connection) => void }) {
  return (
    <PlaylistsProvider client={props.connection.client}>
      <ShellInner {...props} />
    </PlaylistsProvider>
  );
}

function ShellInner({
  connection,
  player,
  onConnectionChange,
}: {
  connection: Connection;
  player: Player;
  onConnectionChange: (c: Connection) => void;
}) {
  const { playlists, create } = usePlaylists();
  const [view, setView] = useState<View>({ name: "albums" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const { client } = connection;

  const navigate = (t: NavTarget) => setView(t);

  // Preferences… (⌘,) from the native app menu.
  useEffect(() => {
    const unlisten = listen("menu:preferences", () => setSettingsOpen(true));
    return () => void unlisten.then((f) => f());
  }, []);

  const navItem = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active ? "bg-base-300 font-semibold" : "text-base-content/60 hover:bg-base-300/60"}`;

  return (
    <div className="flex h-screen flex-col bg-base-200 text-base-content">
      {/* Frameless top bar (draggable; clears the macOS traffic lights). */}
      <header
        className="titlebar-pad flex h-13 shrink-0 items-center gap-4 border-b border-base-300 bg-base-100 pr-3"
        data-tauri-drag-region
      >
        <div className="brand text-lg">
          Blitter<span>Amp</span>
        </div>
        <div className="flex-1" />
        <input
          className="input input-sm input-bordered w-64 max-w-[40vw]"
          placeholder="Search (coming soon)"
          disabled
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title={connection.kind === "local" ? "This computer's library" : `Connected to ${connection.remoteUrl}`}
        >
          <SettingsIcon size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-base-300 bg-base-100 p-3">
          <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Library</div>
          <button type="button" className={navItem(view.name === "albums" || view.name === "album")} onClick={() => setView({ name: "albums" })}>
            <Disc3 size={15} /> Albums
          </button>
          <button type="button" className={navItem(view.name === "artists" || view.name === "artist")} onClick={() => setView({ name: "artists" })}>
            <Mic2 size={15} /> Artists
          </button>
          <button type="button" className={navItem(view.name === "tracks")} onClick={() => setView({ name: "tracks" })}>
            <Music size={15} /> Tracks
          </button>

          <div className="mt-4 flex items-center justify-between px-3 pb-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Playlists</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              aria-label="New playlist"
              onClick={async () => {
                const title = window.prompt("New playlist name");
                if (!title) return;
                const pl = await create(title);
                setView({ name: "playlist", playlistId: pl.playlistId });
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {playlists.map((p) => (
              <button
                key={p.playlistId}
                type="button"
                className={navItem(view.name === "playlist" && view.playlistId === p.playlistId)}
                onClick={() => setView({ name: "playlist", playlistId: p.playlistId })}
              >
                <ListMusic size={15} /> <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {view.name === "albums" && (
            <AlbumsView
              client={client}
              managed={connection.kind === "local"}
              onOpen={(albumId) => setView({ name: "album", albumId })}
              onManage={() => setSettingsOpen(true)}
            />
          )}
          {view.name === "artists" && <ArtistsView client={client} onOpen={(artistId) => setView({ name: "artist", artistId })} />}
          {view.name === "tracks" && <TracksView client={client} player={player} onNavigate={navigate} />}
          {view.name === "album" && (
            <AlbumView client={client} player={player} albumId={view.albumId} onNavigate={navigate} onBack={() => setView({ name: "albums" })} />
          )}
          {view.name === "artist" && (
            <ArtistView client={client} player={player} artistId={view.artistId} onNavigate={navigate} onBack={() => setView({ name: "artists" })} />
          )}
          {view.name === "playlist" && (
            <PlaylistView
              client={client}
              player={player}
              playlistId={view.playlistId}
              onNavigate={navigate}
              onBack={() => setView({ name: "albums" })}
              onDeleted={() => setView({ name: "albums" })}
            />
          )}
        </main>
        {queueOpen && <QueueDrawer client={client} player={player} onClose={() => setQueueOpen(false)} />}
      </div>

      <NowPlayingBar client={client} player={player} queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((o) => !o)} />

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
