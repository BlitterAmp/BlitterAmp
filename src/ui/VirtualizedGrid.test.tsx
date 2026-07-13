// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollContext } from "./ScrollContext";
import { VirtualizedGrid } from "./VirtualizedGrid";

// Grid views stay mounted while display:none. In that state every row
// measures zero height, which convinces the virtualizer that ever more rows
// fit the viewport — hundreds of nested measurement updates then exceed
// React's update-depth ceiling (seen live as "Maximum update depth exceeded"
// ~5s after launch, when the first library snapshot fills the hidden grids).
// A zero-width grid must therefore render NOTHING, and wake when sized.
describe("VirtualizedGrid hidden-state inertness", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function harness(items: string[]) {
    function Harness() {
      const scrollRef = useRef<HTMLDivElement>(null);
      return (
        <div ref={scrollRef}>
          <ScrollContext.Provider value={scrollRef}>
            <VirtualizedGrid
              items={items}
              minimumItemWidth={160}
              gap={16}
              estimatedCaptionHeight={48}
              gridClassName="grid"
              getItemKey={(item) => item}
              renderItem={(item) => (
                <div key={item} data-testid="tile">
                  {item}
                </div>
              )}
            />
          </ScrollContext.Provider>
        </div>
      );
    }
    return render(<Harness />);
  }

  it("renders no rows while its container has zero width", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const { queryAllByTestId } = harness(Array.from({ length: 100 }, (_, i) => `a-${i}`));
    expect(queryAllByTestId("tile").length).toBe(0);
  });

  it("wakes and renders rows when the observer reports real dimensions", () => {
    // The virtualizer registers its own observers through the same global,
    // so the stub must fan out to every registered callback.
    const observerCallbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observerCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    let width = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          width,
          height: 400,
          top: 0,
          left: 0,
          right: width,
          bottom: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    const { container, queryAllByTestId } = harness(Array.from({ length: 60 }, (_, i) => `a-${i}`));
    const gridHeight = () => {
      const grid = container.querySelector("div.relative") as HTMLElement;
      return Number.parseFloat(grid.style.height || "0");
    };
    expect(queryAllByTestId("tile").length).toBe(0);
    expect(gridHeight()).toBe(0);

    width = 640;
    act(() => {
      for (const callback of [...observerCallbacks]) {
        callback([], {} as ResizeObserver);
      }
    });
    // jsdom does no real layout, so visible tiles stay 0 here — but the
    // virtualizer must be ENGAGED: total size reflects all 60 items again.
    expect(gridHeight()).toBeGreaterThan(0);
  });
});
