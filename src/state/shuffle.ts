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

/** Perceptual shuffle: assign every artist stratified random positions across
 * the whole queue, then merge those positions without adjacent artist repeats
 * whenever the remaining counts make that possible. */
export function spreadByArtist(tracks: Track[], random = Math.random): Track[] {
  const buckets = new Map<string, Track[]>();
  for (const track of tracks) {
    const artistId = track.primaryArtist.artistId;
    const bucket = buckets.get(artistId);
    if (bucket) bucket.push(track);
    else buckets.set(artistId, [track]);
  }
  const out: Track[] = [];
  const slots = new Map<string, number[]>();
  for (const [artistId, bucket] of buckets) {
    slots.set(artistId, bucket.map((_, index) => (index + random()) / bucket.length).sort((a, b) => a - b));
  }
  let last: string | null = null;
  let remaining = tracks.length;

  while (remaining > 0) {
    const ranked = [...buckets].filter(([, bucket]) => bucket.length > 0).sort((a, b) => b[1].length - a[1].length);
    const afterPick = remaining - 1;
    const maxChosen = Math.floor(afterPick / 2);
    const maxOther = Math.ceil(afterPick / 2);
    const nonRepeating = ranked.filter(([artistId]) => artistId !== last);
    const feasible = nonRepeating.filter(([artistId, bucket]) => {
      const largestOther = ranked[0]?.[0] === artistId ? (ranked[1]?.[1].length ?? 0) : (ranked[0]?.[1].length ?? 0);
      return bucket.length - 1 <= maxChosen && largestOther <= maxOther;
    });
    const candidates = feasible.length > 0 ? feasible : nonRepeating.length > 0 ? nonRepeating : ranked;
    const selected = candidates.reduce((best, candidate) =>
      (slots.get(candidate[0])?.[0] ?? 1) < (slots.get(best[0])?.[0] ?? 1) ? candidate : best);
    const [artistId, bucket] = selected;
    const trackIndex = Math.floor(random() * bucket.length);
    const track = bucket[trackIndex];
    bucket[trackIndex] = bucket[bucket.length - 1];
    bucket.pop();
    slots.get(artistId)?.shift();
    out.push(track);
    last = artistId;
    remaining--;
  }
  return out;
}
