import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Client, LoveState, Track } from "../api/client";
import type { Player } from "../audio/player";
import { useLibrary } from "../state/library";
import { usePlaylists } from "../state/playlists";
import { AlbumArt } from "./AlbumArt";
import { ArtistCredits } from "./ArtistCredits";
import { LoveControl } from "./LoveControl";
import { usePrompt } from "./PromptProvider";
import { useScrollParent } from "./ScrollContext";

export type NavTarget =
  | { name: "album"; albumId: string }
  | { name: "artist"; artistId: string }
  | { name: "genre"; genre: string };

function fmt(ms: number): string {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

function closeMenus() {
  (document.activeElement as HTMLElement | null)?.blur();
}

/** A reusable track list with play-on-click, per-row taste controls, and a
 * context menu. Virtualized against the app's main scroll container so it stays
 * fast at tens of thousands of rows. */
export function TrackList({
  client,
  player,
  tracks,
  onNavigate,
  showAlbum = false,
  showArtwork = false,
  showAlbumHeaders = false,
  onRemove,
}: {
  client: Client;
  player: Player;
  tracks: Track[];
  onNavigate: (t: NavTarget) => void;
  showAlbum?: boolean;
  showArtwork?: boolean;
  showAlbumHeaders?: boolean;
  /** When set, adds a "Remove from this playlist" menu item. */
  onRemove?: (track: Track) => void;
}) {
  const { playlists, create, append } = usePlaylists();
  const { albumById } = useLibrary();
  const prompt = usePrompt();

  async function addToPlaylist(t: Track, playlistId: string) {
    closeMenus();
    try {
      await append(playlistId, [t.trackId]);
    } catch {
      /* ignore — best effort */
    }
  }

  async function startRadio(t: Track) {
    closeMenus();
    try {
      const radio = await client.radioNext({ seedTrackIds: [t.trackId], count: 30 });
      if (radio.length) await player.playQueue(radio);
    } catch {
      /* ignore */
    }
  }

  async function addToNewPlaylist(t: Track) {
    closeMenus();
    const title = await prompt({ title: "New playlist", placeholder: "Playlist name", confirmLabel: "Create" });
    if (!title) return;
    try {
      const pl = await create(title);
      await append(pl.playlistId, [t.trackId]);
    } catch {
      /* ignore */
    }
  }

  // Local love overlay so toggles reflect instantly.
  const [loves, setLoves] = useState<Record<string, LoveState | undefined>>({});
  const [loveError, setLoveError] = useState("");
  useEffect(() => {
    setLoves(Object.fromEntries(tracks.map((t) => [t.trackId, t.loveState])));
  }, [tracks]);

  async function love(t: Track, state: LoveState) {
    const prev = loves[t.trackId];
    setLoveError("");
    setLoves((m) => ({ ...m, [t.trackId]: state === "neutral" ? undefined : state }));
    try {
      await client.setLove(t.trackId, state);
    } catch {
      setLoves((m) => ({ ...m, [t.trackId]: prev }));
      setLoveError(`Could not update taste for ${t.title}.`);
    }
  }

  // ── virtualization ──
  const scrollRef = useScrollParent();
  const listRef = useRef<HTMLDivElement>(null);
  const rowH = showAlbum ? 56 : 44;
  const hasAlbumHeader = (index: number) => showAlbumHeaders && (index === 0 || tracks[index - 1]?.albumId !== tracks[index]?.albumId);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const scroll = scrollRef?.current;
    if (!list || !scroll) return;
    const measure = () =>
      setScrollMargin(list.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroll);
    ro.observe(list);
    return () => ro.disconnect();
  }, [scrollRef, tracks.length]);

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: (index) => rowH + (hasAlbumHeader(index) ? 36 : 0),
    getItemKey: (index) => tracks[index]?.trackId ?? `missing-${index}`,
    overscan: 12,
    scrollMargin,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {loveError && <div role="alert" className="sr-only">{loveError}</div>}
      {virtualizer.getVirtualItems().map((vi) => {
        const t = tracks[vi.index];
        const i = vi.index;
        const albumHeader = hasAlbumHeader(i);
        const album = albumById.get(t.albumId);
        return (
          <div
            key={t.trackId}
            className="absolute left-0 w-full"
            style={{ top: 0, height: rowH + (albumHeader ? 36 : 0), transform: `translateY(${vi.start - scrollMargin}px)` }}
          >
            {albumHeader && (
              <button type="button" className="flex h-9 items-center gap-2 text-left hover:text-primary" onClick={() => onNavigate({ name: "album", albumId: t.albumId })}>
                <span className="font-semibold">{album?.title ?? t.albumTitle}</span>
                {album?.year && <span className="text-xs opacity-50">{album.year}</span>}
              </button>
            )}
            <div
              className="group flex w-full cursor-pointer items-center gap-2 border-b border-base-200/40 px-2 hover:bg-base-200/40"
              style={{ height: rowH }}
              onDoubleClick={() => void player.playQueue(tracks, i)}
            >
            {showArtwork ? (
              <button type="button" className="size-10 shrink-0 overflow-hidden rounded" onClick={() => void player.playQueue(tracks, i)} aria-label={`Play ${t.title}`}>
                <AlbumArt artId={t.artId ?? albumById.get(t.albumId)?.artId} size={80} alt="" />
              </button>
            ) : (
              <div className="w-8 shrink-0 text-right tabular-nums opacity-50" onClick={() => void player.playQueue(tracks, i)}>
                {t.index ?? i + 1}
              </div>
            )}
            <div className="min-w-0 flex-1" onClick={() => void player.playQueue(tracks, i)}>
              <div className="truncate font-medium">{t.title}</div>
              {showAlbum && <div className="truncate text-xs opacity-60">{t.albumTitle}</div>}
              {!player.canPlay(t) && <span className="text-xs opacity-50">({t.media.container} — unsupported)</span>}
            </div>
            <ArtistCredits
              credits={t.artistCredits}
              className="w-32 shrink-0 truncate text-left text-xs opacity-60"
              onOpenArtist={(artistId) => onNavigate({ name: "artist", artistId })}
            />
            <div className="flex shrink-0 items-center justify-end">
              <LoveControl state={loves[t.trackId]} onChange={(s) => void love(t, s)} label={`Taste for ${t.title}`} />
            </div>
            <div className="w-14 shrink-0 text-right tabular-nums opacity-60">{fmt(t.durationMs)}</div>
            <div className="w-8 shrink-0">
              <div className="dropdown dropdown-end">
                <button tabIndex={0} type="button" className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100" aria-label="More">
                  <MoreHorizontal size={15} />
                </button>
                <ul tabIndex={0} className="menu dropdown-content z-10 w-48 rounded-box bg-base-200 p-1 shadow-lg">
                  <li><button type="button" onClick={() => { closeMenus(); void player.playQueue(tracks, i); }}>Play</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); player.playNext([t]); }}>Play next</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); player.addToQueue([t]); }}>Add to queue</button></li>
                  <li><button type="button" onClick={() => void startRadio(t)}>Start radio</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); onNavigate({ name: "album", albumId: t.albumId }); }}>Go to album</button></li>
                  <li>
                    <details>
                      <summary>Go to artist</summary>
                      <ul>
                        {t.artistCredits.filter((credit, index, credits) => credits.findIndex((candidate) => candidate.artistId === credit.artistId) === index).map((credit) => (
                          <li key={credit.artistId}>
                            <button type="button" onClick={() => { closeMenus(); onNavigate({ name: "artist", artistId: credit.artistId }); }}>
                              {credit.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                  <li>
                    <details>
                      <summary>Add to playlist</summary>
                      <ul className="max-h-60 overflow-y-auto">
                        <li><button type="button" onClick={() => void addToNewPlaylist(t)}>New playlist…</button></li>
                        {playlists.filter((p) => p.origin === "blitterserver").map((p) => (
                          <li key={p.playlistId}><button type="button" onClick={() => void addToPlaylist(t, p.playlistId)}>{p.title}</button></li>
                        ))}
                      </ul>
                    </details>
                  </li>
                  {onRemove && (
                    <li>
                      <button type="button" className="text-error" onClick={() => { closeMenus(); onRemove(t); }}>
                        Remove from playlist
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
