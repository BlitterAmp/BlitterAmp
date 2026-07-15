import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useScrollParent } from "./ScrollContext";
import { chunkIntoRows, columnCountForWidth, settleMeasurement } from "./virtualGrid";

/** A responsive CSS grid virtualized by rows against the app's main scroller. */
export function VirtualizedGrid<T>({
  items,
  minimumItemWidth,
  gap,
  estimatedCaptionHeight,
  gridClassName,
  getItemKey,
  renderItem,
}: {
  items: readonly T[];
  minimumItemWidth: number;
  gap: number;
  estimatedCaptionHeight: number;
  gridClassName: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const scrollRef = useScrollParent();
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columns = columnCountForWidth(containerWidth, minimumItemWidth, gap);
  const rows = chunkIntoRows(items, columns);
  const tileWidth = containerWidth > 0
    ? (containerWidth - gap * (columns - 1)) / columns
    : minimumItemWidth;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const scroll = scrollRef?.current;
    // The grid's own height depends on these measurements, so the observer
    // refires after every render. Round to whole pixels and bail on equal
    // values or the feedback loop runs until React aborts the tree
    // ("maximum update depth exceeded" — seen live on WebKitGTK; jsdom never
    // fires ResizeObserver, so only integer-stable updates are safe here).
    const measure = () => {
      const gridRect = grid.getBoundingClientRect();
      const width = gridRect.width;
      setContainerWidth((previous) => settleMeasurement(previous, width));
      // A kept-alive route is display:none. Deactivate it before measuring
      // offsets so zero-height rows cannot poison the virtualizer's size cache.
      if (width <= 0) return;
      if (scroll) {
        // Offset of the grid within the scroller's content: scroll-position
        // independent, so it only moves when layout above the grid changes.
        const margin =
          gridRect.top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        setScrollMargin((previous) => settleMeasurement(previous, margin));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // Observe only the grid: its width already tracks the scroller's, and
    // observing the scroller retriggers on every content-height change.
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [scrollRef, items.length]);

  // A stable estimate keeps the virtualizer from remeasuring every render.
  const rowEstimate = Math.round(tileWidth + estimatedCaptionHeight + gap);
  const estimateSize = useCallback(() => rowEstimate, [rowEstimate]);
  // Grid views stay mounted while display:none (instant tab switches). A
  // hidden grid measures every row at zero height, which convinces the
  // virtualizer that ever more rows fit — hundreds of nested measurement
  // updates blow React's update-depth ceiling. Zero width ⇒ fully inert;
  // the ResizeObserver wakes the grid when it gains real dimensions.
  const active = containerWidth > 0;
  const virtualizer = useVirtualizer({
    count: active ? rows.length : 0,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize,
    // The library sync reshapes the item list continuously during bootstrap;
    // the virtualizer can hand back indexes from a stale measurement pass, so
    // every row lookup must tolerate a vanished row instead of throwing.
    getItemKey: (index) => {
      const row = rows[index];
      return row ? getItemKey(row[0]) : `missing-${index}`;
    },
    overscan: 3,
    scrollMargin,
  });

  return (
    <div ref={gridRef} className="relative min-w-0 w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            className={`${gridClassName} absolute left-0 top-0 w-full`}
            style={{
              paddingBottom: virtualRow.index < rows.length - 1 ? gap : 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {row.map(renderItem)}
          </div>
        );
      })}
    </div>
  );
}
