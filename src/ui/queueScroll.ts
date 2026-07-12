import type { Track } from "../api/client";

export const QUEUE_ROW_HEIGHT = 48;

function clampOffset(offset: number, count: number, viewportHeight: number): number {
  return Math.max(0, Math.min(offset, Math.max(0, count * QUEUE_ROW_HEIGHT - viewportHeight)));
}

function occurrenceAt(queue: Track[], index: number): number {
  const trackId = queue[index]?.trackId;
  let occurrence = 0;
  for (let i = 0; i <= index; i++) if (queue[i].trackId === trackId) occurrence++;
  return occurrence;
}

function findOccurrence(queue: Track[], trackId: string, occurrence: number): number {
  let seen = 0;
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].trackId === trackId && ++seen === occurrence) return i;
  }
  return -1;
}

export function projectQueueScrollOffset(
  offset: number,
  oldQueue: Track[],
  oldStartIndex: number,
  newQueue: Track[],
  newStartIndex: number,
  viewportHeight: number,
): number {
  const count = Math.max(0, newQueue.length - newStartIndex);
  if (oldQueue === newQueue) {
    return Math.max(0, offset + (oldStartIndex - newStartIndex) * QUEUE_ROW_HEIGHT);
  }

  const relativeIndex = Math.floor(offset / QUEUE_ROW_HEIGHT);
  const oldIndex = oldStartIndex + relativeIndex;
  const anchor = oldQueue[oldIndex];
  if (anchor) {
    const newIndex = findOccurrence(newQueue, anchor.trackId, occurrenceAt(oldQueue, oldIndex));
    if (newIndex >= newStartIndex) {
      const withinRow = offset % QUEUE_ROW_HEIGHT;
      return clampOffset((newIndex - newStartIndex) * QUEUE_ROW_HEIGHT + withinRow, count, viewportHeight);
    }
  }

  return clampOffset(offset, count, viewportHeight);
}
