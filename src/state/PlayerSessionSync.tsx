import { useEffect, useRef } from "react";
import type { Player } from "../audio/player";
import { useLibrary } from "./library";
import { loadPlayerState, savePlayerState } from "./playerSession";

export function PlayerSessionSync({ player, scope }: { player: Player; scope: string }) {
  const { ready, tracks } = useLibrary();
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void loadPlayerState(scope).then((saved) => {
      if (cancelled) return;
      if (saved) player.restore(saved, new Map(tracksRef.current.map((track) => [track.trackId, track])));
      unsubscribe = player.subscribe(() => {
        if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            void savePlayerState(scope, player.savedState());
          }, 750);
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timer) clearTimeout(timer);
      if (unsubscribe) void savePlayerState(scope, player.savedState());
    };
  }, [player, ready, scope]);

  return null;
}
