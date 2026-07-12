import { createContext, type RefObject, useContext } from "react";

// The app's main scroll container, shared so virtualized lists (TrackList) can
// window against it instead of rendering thousands of rows.
export const ScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useScrollParent(): RefObject<HTMLElement | null> | null {
  return useContext(ScrollContext);
}
