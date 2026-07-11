import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { Album, Client, HomeRails, Track } from "../../api/client";
import type { Player } from "../../audio/player";
import { useLibraryVersion } from "../../state/useLibrarySync";
import { AlbumArt } from "../AlbumArt";
import { TrackList, type NavTarget } from "../TrackList";

export function HomeView({
  client,
  player,
  onNavigate,
  onOpenMix,
  onOpenPlaylist,
}: {
  client: Client;
  player: Player;
  onNavigate: (t: NavTarget) => void;
  onOpenMix: (mixId: string, title: string) => void;
  onOpenPlaylist: (playlistId: string) => void;
}) {
  const [home, setHome] = useState<HomeRails | null>(null);
  const [error, setError] = useState("");
  const libVersion = useLibraryVersion(client);

  useEffect(() => {
    client
      .home()
      .then(setHome)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load home."));
  }, [client, libVersion]);

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold">Home</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {home?.rails.map((rail, i) => (
        <div key={`${rail.kind}-${i}`}>
          <h2 className="mb-3 text-lg font-semibold">{rail.title}</h2>

          {rail.mixes && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {rail.mixes.map((m) => (
                <button key={m.mixId} type="button" className="group text-left" onClick={() => onOpenMix(m.mixId, m.title)}>
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-box bg-gradient-to-br from-primary/30 to-secondary/30 shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                    <span className="px-2 text-center text-lg font-semibold">{m.title}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{m.title}</div>
                </button>
              ))}
            </div>
          )}

          {rail.playlists && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {rail.playlists.map((p) => (
                <button key={p.playlistId} type="button" className="group text-left" onClick={() => onOpenPlaylist(p.playlistId)}>
                  <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                    <AlbumArt client={client} artId={p.artId} alt={p.title} />
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{p.title}</div>
                </button>
              ))}
            </div>
          )}

          {rail.albums && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {rail.albums.map((a: Album) => (
                <button key={a.albumId} type="button" className="group text-left" onClick={() => onNavigate({ name: "album", albumId: a.albumId })}>
                  <div className="aspect-square overflow-hidden rounded-box shadow-sm transition group-hover:ring-2 group-hover:ring-primary/60">
                    <AlbumArt client={client} artId={a.artId} alt={a.title} />
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{a.title}</div>
                  <div className="truncate text-xs opacity-60">{a.artistName}</div>
                </button>
              ))}
            </div>
          )}

          {rail.tracks && <RailTracks client={client} player={player} tracks={rail.tracks} onNavigate={onNavigate} />}
        </div>
      ))}
    </section>
  );
}

function RailTracks({ client, player, tracks, onNavigate }: { client: Client; player: Player; tracks: Track[]; onNavigate: (t: NavTarget) => void }) {
  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm mb-2 gap-2" onClick={() => void player.playQueue(tracks)}>
        <Play size={14} /> Play all
      </button>
      <TrackList client={client} player={player} tracks={tracks.slice(0, 10)} onNavigate={onNavigate} showAlbum />
    </div>
  );
}
