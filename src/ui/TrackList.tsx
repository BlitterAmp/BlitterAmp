import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client, LoveState, Track } from "../api/client";
import type { Player } from "../audio/player";
import { LoveButton } from "./LoveButton";
import { StarRating } from "./StarRating";

export type NavTarget = { name: "album"; albumId: string } | { name: "artist"; artistId: string };

function fmt(ms: number): string {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

function closeMenus() {
  (document.activeElement as HTMLElement | null)?.blur();
}

/** A reusable track table with play-on-click, per-row love + rating, and a
 * context menu (play next / add to queue / go to album|artist / not for me). */
export function TrackList({
  client,
  player,
  tracks,
  onNavigate,
  showAlbum = false,
}: {
  client: Client;
  player: Player;
  tracks: Track[];
  onNavigate: (t: NavTarget) => void;
  showAlbum?: boolean;
}) {
  // Local love/rating overlay so toggles reflect instantly (seeded from the
  // server's per-profile decoration).
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

  return (
    <table className="table table-sm">
      <tbody>
        {tracks.map((t, i) => (
          <tr key={t.trackId} className="hover group cursor-pointer" onDoubleClick={() => void player.playQueue(tracks, i)}>
            <td className="w-8 text-right tabular-nums opacity-50" onClick={() => void player.playQueue(tracks, i)}>
              {t.index ?? i + 1}
            </td>
            <td onClick={() => void player.playQueue(tracks, i)}>
              <div className="font-medium">{t.title}</div>
              {showAlbum && <div className="text-xs opacity-60">{t.albumTitle}</div>}
              {!player.canPlay(t) && <span className="text-xs opacity-50">({t.media.container} — needs the mpv engine)</span>}
            </td>
            <td className="w-40">
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <LoveButton state={loves[t.trackId]} onChange={(s) => void love(t, s)} />
                <StarRating rating10={ratings[t.trackId] ?? 0} onChange={(r) => void rate(t, r)} />
              </div>
            </td>
            <td className="w-14 text-right tabular-nums opacity-60">{fmt(t.durationMs)}</td>
            <td className="w-8">
              <div className="dropdown dropdown-end">
                <button tabIndex={0} type="button" className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100" aria-label="More">
                  <MoreHorizontal size={15} />
                </button>
                <ul tabIndex={0} className="menu dropdown-content z-10 w-48 rounded-box bg-base-200 p-1 shadow-lg">
                  <li><button type="button" onClick={() => { closeMenus(); void player.playQueue(tracks, i); }}>Play</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); player.playNext([t]); }}>Play next</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); player.addToQueue([t]); }}>Add to queue</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); onNavigate({ name: "album", albumId: t.albumId }); }}>Go to album</button></li>
                  <li><button type="button" onClick={() => { closeMenus(); onNavigate({ name: "artist", artistId: t.artistId }); }}>Go to artist</button></li>
                  <li>
                    <button type="button" onClick={() => { closeMenus(); void love(t, loves[t.trackId] === "not_for_me" ? "neutral" : "not_for_me"); }}>
                      {loves[t.trackId] === "not_for_me" ? "Un-exclude" : "Not for me"}
                    </button>
                  </li>
                </ul>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
