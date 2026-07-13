import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useScrollParent } from "./ScrollContext";
import { chunkIntoRows, columnCountForWidth } from "./virtualGrid";

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
    const measure = () => {
      const width = grid.getBoundingClientRect().width;
      if (width > 0) setContainerWidth(width);
      if (scroll) {
        setScrollMargin(grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    if (scroll) observer.observe(scroll);
    return () => observer.disconnect();
  }, [scrollRef, items.length]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: () => tileWidth + estimatedCaptionHeight + gap,
    getItemKey: (index) => getItemKey(rows[index][0]),
    overscan: 3,
    scrollMargin,
  });

  return (
    <div ref={gridRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => (
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
          {rows[virtualRow.index].map(renderItem)}
        </div>
      ))}
    </div>
  );
}
