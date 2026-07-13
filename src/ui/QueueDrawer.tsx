import { useVirtualizer } from "@tanstack/react-virtual";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ArtistCredit, Client } from "../api/client";
import type { Player } from "../audio/player";
import { AlbumArt } from "./AlbumArt";
import { ArtistCredits } from "./ArtistCredits";
import { projectQueueScrollOffset, QUEUE_ROW_HEIGHT } from "./queueScroll";
import type { NavTarget } from "./TrackList";

export function QueueDrawer({ client, player, onClose, onNavigate = () => {} }: { client: Client; player: Player; onClose: () => void; onNavigate?: (target: NavTarget) => void }) {
  const s = useSyncExternalStore(
    (notify) => player.subscribeQueue(notify),
    () => player.currentQueueState(),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const startIndex = s.queueIndex + 1;
  const count = Math.max(0, s.queue.length - startIndex);
  const previousQueue = useRef({ queue: s.queue, startIndex });
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => QUEUE_ROW_HEIGHT,
    getItemKey: (index) => {
      const queueIndex = startIndex + index;
      return `${s.queue[queueIndex].trackId}-${queueIndex}`;
    },
    overscan: 5,
  });
  const rows = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    const previous = previousQueue.current;
    previousQueue.current = { queue: s.queue, startIndex };
    if (!scrollElement || (previous.queue === s.queue && previous.startIndex === startIndex)) return;

    const offset = projectQueueScrollOffset(
      scrollElement.scrollTop,
      previous.queue,
      previous.startIndex,
      s.queue,
      startIndex,
      scrollElement.clientHeight,
    );
    if (offset !== scrollElement.scrollTop) virtualizer.scrollToOffset(offset);
  }, [s.queue, startIndex, virtualizer]);

  return (
    <aside className="flex min-h-0 w-80 shrink-0 flex-col border-l border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <span className="font-semibold">Queue</span>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => player.clearUpNext()}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onClose} aria-label="Close queue">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="shrink-0 p-2 pb-0">
        {s.track && (
          <>
            <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Now playing</div>
            <Row client={client} title={s.track.title} artistCredits={s.track.artistCredits} artId={s.track.artId} active onClick={() => {}} onOpenArtist={onNavigate} />
          </>
        )}
        {count > 0 && (
          <div className="mt-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Up next</div>
        )}
        {!s.track && count === 0 && <div className="p-4 text-center text-sm opacity-50">The queue is empty.</div>}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div
          role="list"
          aria-label={`${count} ${count === 1 ? "track" : "tracks"} up next`}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {rows.map((virtualRow) => {
            const queueIndex = startIndex + virtualRow.index;
            const t = s.queue[queueIndex];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                role="listitem"
                aria-setsize={count}
                aria-posinset={virtualRow.index + 1}
                className="absolute left-0 top-0 w-full"
                style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
              >
                <Row
                  client={client}
                  title={t.title}
                  artistCredits={t.artistCredits}
                  artId={t.artId}
                  onClick={() => void player.jumpTo(queueIndex)}
                  onRemove={() => player.removeFromQueue(queueIndex)}
                  onOpenArtist={onNavigate}
                />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function Row({
  client,
  title,
  artistCredits,
  artId,
  active,
  onClick,
  onRemove,
  onOpenArtist,
}: {
  client: Client;
  title: string;
  artistCredits: ArtistCredit[];
  artId?: string | null;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  onOpenArtist: (target: NavTarget) => void;
}) {
  return (
    <div className={`group flex h-12 items-center gap-2 rounded-lg px-2 ${active ? "bg-base-300" : "hover:bg-base-200"}`}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onClick}>
        <div className="size-9 shrink-0 overflow-hidden rounded">
          <AlbumArt client={client} artId={artId} size={72} alt="" />
        </div>
        <div className="min-w-0">
          <div className={`truncate text-sm ${active ? "font-semibold text-primary" : ""}`}>{title}</div>
        </div>
      </button>
      <ArtistCredits
        credits={artistCredits}
        className="max-w-24 truncate text-xs opacity-60"
        onOpenArtist={(artistId) => onOpenArtist({ name: "artist", artistId })}
      />
      {onRemove && (
        <button type="button" className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100" onClick={onRemove} aria-label="Remove">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
