// Shuffle preference. "random" is a plain Fisher–Yates; "spread" avoids playing
// the same artist (and thus mostly the same album) back-to-back. Persisted in
// localStorage (synchronous, like the theme) so the player can read it inline.
import type { Track } from "../api/client";

export type ShuffleMode = "spread" | "random";

const KEY = "blitteramp.shuffleMode";

export function getShuffleMode(): ShuffleMode {
  return localStorage.getItem(KEY) === "random" ? "random" : "spread";
}

export function setShuffleMode(mode: ShuffleMode): void {
  localStorage.setItem(KEY, mode);
}

/** Reorders an already-randomized list so the same artist is spread out:
 * round-robin from per-artist buckets, always preferring the biggest bucket
 * whose artist differs from the one just played. */
export function spreadByArtist(tracks: Track[]): Track[] {
  const buckets = new Map<string, Track[]>();
  for (const t of tracks) {
    const arr = buckets.get(t.artistId);
    if (arr) arr.push(t);
    else buckets.set(t.artistId, [t]);
  }
  const lists = [...buckets.values()];
  const out: Track[] = [];
  let last: string | null = null;
  while (out.length < tracks.length) {
    const avail = lists.filter((l) => l.length > 0).sort((a, b) => b.length - a.length);
    const pick = avail.find((l) => l[0].artistId !== last) ?? avail[0];
    const t = pick.shift();
    if (!t) break;
    out.push(t);
    last = t.artistId;
  }
  return out;
}
