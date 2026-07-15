import { load, type Store } from "@tauri-apps/plugin-store";
import type { SavedPlayerState } from "../audio/player";

const STORE_FILE = "player.json";
let store: Store | null = null;
let writes = Promise.resolve();

async function backing(): Promise<Store> {
  if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  return store;
}

export function parseSavedPlayerState(value: unknown): SavedPlayerState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<SavedPlayerState>;
  if (
    state.version !== 1 ||
    !Array.isArray(state.queueTrackIds) || !state.queueTrackIds.every((id) => typeof id === "string") ||
    !Array.isArray(state.orderedTrackIds) || !state.orderedTrackIds.every((id) => typeof id === "string") ||
    !Number.isInteger(state.queueIndex) || !Number.isFinite(state.positionSec) || !Number.isFinite(state.volume) ||
    typeof state.shuffle !== "boolean" || !["off", "all", "one"].includes(state.repeat ?? "")
  ) return null;
  return {
    version: 1,
    queueTrackIds: state.queueTrackIds.slice(0, 20_000),
    orderedTrackIds: state.orderedTrackIds.slice(0, 20_000),
    queueIndex: state.queueIndex as number,
    positionSec: Math.max(0, state.positionSec as number),
    volume: Math.max(0, Math.min(1, state.volume as number)),
    shuffle: state.shuffle,
    repeat: state.repeat as SavedPlayerState["repeat"],
  };
}

export async function loadPlayerState(scope: string): Promise<SavedPlayerState | null> {
  return parseSavedPlayerState(await (await backing()).get(`session:${scope}`));
}

export function savePlayerState(scope: string, state: SavedPlayerState): Promise<void> {
  writes = writes.catch(() => {}).then(async () => {
    const target = await backing();
    await target.set(`session:${scope}`, state);
    await target.save();
  });
  return writes;
}
