import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Client, LoveState, Track } from "../api/client";
import type { Player } from "../audio/player";
import { usePlaylists } from "../state/playlists";
import { LoveButton } from "./LoveButton";
import { usePrompt } from "./PromptProvider";
import { useScrollParent } from "./ScrollContext";
import { StarRating } from "./StarRating";

export type NavTarget = { name: "album"; albumId: string } | { name: "artist"; artistId: string };

function fmt(ms: number): string {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

function closeMenus() {
  (document.activeElement as HTMLElement | null)?.blur();
}

/** A reusable track list with play-on-click, per-row love + rating, and a
 * context menu. Virtualized against the app's main scroll container so it stays
 * fast at tens of thousands of rows. */
export function TrackList({
  client,
  player,
  tracks,
  onNavigate,
  showAlbum = false,
  onRemove,
}: {
  client: Client;
  player: Player;
  tracks: Track[];
  onNavigate: (t: NavTarget) => void;
  showAlbum?: boolean;
  /** When set, adds a "Remove from this playlist" menu item. */
  onRemove?: (track: Track) => void;
}) {
  const { playlists, create, append } = usePlaylists();
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

  // Local love/rating overlay so toggles reflect instantly.
  const [loves, setLoves] = useState<Record<string, LoveState | undefined>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  useEffect(() => {
    setLoves(Object.fromEntries(tracks.map((t) => [t.trackId, t.loveState])));
    setRatings(Object.fromEntries(tracks.map((t) => [t.trackId, t.userRating10 ?? 0])));
  }, [tracks]);

  async function love(t: Track, state: LoveState) {
    const prev = loves[t.trackId];
    setLoves((m) => ({ ...m, [t.trackId]: state === "neutral" ? undefined : state }));
    try {
      await client.setLove(t.trackId, state);
    } catch {
      setLoves((m) => ({ ...m, [t.trackId]: prev }));
    }
  }

  async function rate(t: Track, rating10: number) {
    const prev = ratings[t.trackId] ?? 0;
    setRatings((m) => ({ ...m, [t.trackId]: rating10 }));
    try {
      await client.setRating("track", t.trackId, rating10 || null);
    } catch {
      setRatings((m) => ({ ...m, [t.trackId]: prev }));
    }
  }

  // ── virtualization ──
  const scrollRef = useScrollParent();
  const listRef = useRef<HTMLDivElement>(null);
  const rowH = showAlbum ? 56 : 44;
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
    estimateSize: () => rowH,
    overscan: 12,
    scrollMargin,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const t = tracks[vi.index];
        const i = vi.index;
        return (
          <div
            key={t.trackId}
            className="group absolute left-0 flex w-full cursor-pointer items-center gap-2 border-b border-base-200/40 px-2 hover:bg-base-200/40"
            style={{ top: 0, height: rowH, transform: `translateY(${vi.start - scrollMargin}px)` }}
            onDoubleClick={() => void player.playQueue(tracks, i)}
          >
            <div className="w-8 shrink-0 text-right tabular-nums opacity-50" onClick={() => void player.playQueue(tracks, i)}>
              {t.index ?? i + 1}
            </div>
            <div className="min-w-0 flex-1" onClick={() => void player.playQueue(tracks, i)}>
              <div className="truncate font-medium">{t.title}</div>
              {showAlbum && <div className="truncate text-xs opacity-60">{t.albumTitle}</div>}
              {!player.canPlay(t) && <span className="text-xs opacity-50">({t.media.container} — unsupported)</span>}
            </div>
            <div className="flex w-40 shrink-0 items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
              <LoveButton state={loves[t.trackId]} onChange={(s) => void love(t, s)} />
              <StarRating rating10={ratings[t.trackId] ?? 0} onChange={(r) => void rate(t, r)} />
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
                  <li><button type="button" onClick={() => { closeMenus(); onNavigate({ name: "artist", artistId: t.artistId }); }}>Go to artist</button></li>
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
                  <li>
                    <button type="button" onClick={() => { closeMenus(); void love(t, loves[t.trackId] === "not_for_me" ? "neutral" : "not_for_me"); }}>
                      {loves[t.trackId] === "not_for_me" ? "Un-exclude" : "Not for me"}
                    </button>
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
        );
      })}
    </div>
  );
}
