import { listen } from "@tauri-apps/api/event";
import { Disc3, Home, ListMusic, Mic2, Music, Plus, Search, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Player } from "../audio/player";
import { ScrollContext } from "./ScrollContext";
import { usePrompt } from "./PromptProvider";
import type { Connection } from "../state/connection";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueueDrawer } from "./QueueDrawer";
import { PlaylistsProvider, usePlaylists } from "../state/playlists";
import { PlaylistView } from "./views/PlaylistView";
import { HomeView } from "./views/HomeView";
import { SearchView } from "./views/SearchView";
import { MixView } from "./views/MixView";
import { Settings } from "./Settings";
import { AboutModal } from "./AboutModal";
import { UpdatePrompt } from "./UpdatePrompt";
import { LogsModal } from "./LogsModal";
import { LinuxAppMenu, LinuxWindowControls } from "./LinuxWindowChrome";
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
  | { name: "playlist"; playlistId: string }
  | { name: "home" }
  | { name: "search" }
  | { name: "mix"; mixId: string; title: string };

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
  const [view, setView] = useState<View>({ name: "home" });
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const { client } = connection;
  const mainRef = useRef<HTMLElement>(null);
  const prompt = usePrompt();
  const isLinux = document.documentElement.dataset.platform === "linux";

  const navigate = (t: NavTarget) => setView(t);

  // Preferences… (⌘,) from the native app menu.
  useEffect(() => {
    const unlisten = Promise.all([
      listen("menu:preferences", () => setSettingsOpen(true)),
      listen("menu:about", () => setAboutOpen(true)),
      listen("menu:logs", () => setLogsOpen(true)),
    ]);
    return () => void unlisten.then((fns) => fns.forEach((f) => f()));
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
        {isLinux && (
          <LinuxAppMenu
            onSettings={() => setSettingsOpen(true)}
            onAbout={() => setAboutOpen(true)}
            onLogs={() => setLogsOpen(true)}
          />
        )}
        <div className="brand text-lg">
          Blitter<span>Amp</span>
        </div>
        <div className="flex-1" />
        <label className="input input-sm input-bordered flex w-72 max-w-[40vw] items-center gap-2">
          <Search size={14} className="opacity-50" />
          <input
            className="grow"
            placeholder="Search your library"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setView({ name: "search" });
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title={connection.kind === "local" ? "This computer's library" : `Connected to ${connection.remoteUrl}`}
        >
          <SettingsIcon size={16} />
        </button>
        {isLinux && <LinuxWindowControls />}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-base-300 bg-base-100 p-3">
          <button type="button" className={navItem(view.name === "home" || view.name === "mix")} onClick={() => setView({ name: "home" })}>
            <Home size={15} /> Home
          </button>
          <div className="mt-2 px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Library</div>
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
                const title = await prompt({ title: "New playlist", placeholder: "Playlist name", confirmLabel: "Create" });
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

        <ScrollContext.Provider value={mainRef}>
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-6">
          {/* Grid views stay mounted (hidden when inactive) so switching back is
              instant and their art doesn't re-flash. */}
          <div hidden={view.name !== "albums"}>
            <AlbumsView
              client={client}
              managed={connection.kind === "local"}
              onOpen={(albumId) => setView({ name: "album", albumId })}
              onOpenArtist={(artistId) => setView({ name: "artist", artistId })}
              onManage={() => setSettingsOpen(true)}
            />
          </div>
          <div hidden={view.name !== "artists"}>
            <ArtistsView client={client} onOpen={(artistId) => setView({ name: "artist", artistId })} />
          </div>
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
          <div hidden={view.name !== "home"}>
            <HomeView
              client={client}
              player={player}
              onNavigate={navigate}
              onOpenMix={(mixId, title) => setView({ name: "mix", mixId, title })}
              onOpenPlaylist={(playlistId) => setView({ name: "playlist", playlistId })}
            />
          </div>
          {view.name === "search" && <SearchView client={client} player={player} query={search} onNavigate={navigate} />}
          {view.name === "mix" && (
            <MixView client={client} player={player} mixId={view.mixId} title={view.title} onNavigate={navigate} onBack={() => setView({ name: "home" })} />
          )}
        </main>
        </ScrollContext.Provider>
        {queueOpen && <QueueDrawer client={client} player={player} onClose={() => setQueueOpen(false)} onNavigate={navigate} />}
      </div>

      <NowPlayingBar client={client} player={player} queueOpen={queueOpen} onToggleQueue={() => setQueueOpen((o) => !o)} onNavigate={navigate} />

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

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}

      <UpdatePrompt />
    </div>
  );
}
