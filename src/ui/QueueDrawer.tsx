import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Client } from "../api/client";
import type { Player, PlayerState } from "../audio/player";
import { AlbumArt } from "./AlbumArt";

export function QueueDrawer({ client, player, onClose }: { client: Client; player: Player; onClose: () => void }) {
  const [s, setS] = useState<PlayerState>(player.currentState());
  useEffect(() => player.subscribe(setS), [player]);

  const upNext = s.queue.slice(s.queueIndex + 1);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <span className="font-semibold">Queue</span>
        <div className="flex items-center gap-1">
          {upNext.length > 0 && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => player.clearUpNext()}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onClose} aria-label="Close queue">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {s.track && (
          <>
            <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Now playing</div>
            <Row client={client} title={s.track.title} sub={s.track.artistName} artId={s.track.artId} active onClick={() => {}} />
          </>
        )}
        {upNext.length > 0 && (
          <div className="mt-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-50">Up next</div>
        )}
        {upNext.map((t, i) => {
          const queueIndex = s.queueIndex + 1 + i;
          return (
            <Row
              key={`${t.trackId}-${queueIndex}`}
              client={client}
              title={t.title}
              sub={t.artistName}
              artId={t.artId}
              onClick={() => void player.jumpTo(queueIndex)}
              onRemove={() => player.removeFromQueue(queueIndex)}
            />
          );
        })}
        {!s.track && upNext.length === 0 && <div className="p-4 text-center text-sm opacity-50">The queue is empty.</div>}
      </div>
    </aside>
  );
}

function Row({
  client,
  title,
  sub,
  artId,
  active,
  onClick,
  onRemove,
}: {
  client: Client;
  title: string;
  sub: string;
  artId?: string | null;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${active ? "bg-base-300" : "hover:bg-base-200"}`}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onClick}>
        <div className="size-9 shrink-0 overflow-hidden rounded">
          <AlbumArt client={client} artId={artId} size={72} alt="" />
        </div>
        <div className="min-w-0">
          <div className={`truncate text-sm ${active ? "font-semibold text-primary" : ""}`}>{title}</div>
          <div className="truncate text-xs opacity-60">{sub}</div>
        </div>
      </button>
      {onRemove && (
        <button type="button" className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100" onClick={onRemove} aria-label="Remove">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
