import { useEffect, useState } from "react";
import type { Client } from "../api/client";

/** Returns a version number that bumps whenever the library changes (e.g. a
 * background scan indexes more tracks), so browse views can reload. Polls the
 * cheap library summary, backing off once counts stabilize. */
export function useLibraryVersion(client: Client): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let stop = false;
    let last = "";
    let stable = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const lib = await client.library();
        const sig = `${lib.updatedAt}:${lib.counts.tracks ?? 0}`;
        if (sig !== last) {
          last = sig;
          stable = 0;
          setVersion((v) => v + 1);
        } else {
          stable += 1;
        }
      } catch {
        /* transient — keep polling */
      }
      if (!stop && stable < 6) setTimeout(tick, stable < 2 ? 1200 : 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [client]);
  return version;
}
