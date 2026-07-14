// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryActivity } from "../api/client";
import { LibraryActivityPill } from "./LibraryActivityPill";

function activity(
  stage: LibraryActivity["stage"],
  counts: LibraryActivity["counts"],
  state: LibraryActivity["state"] = "running",
): LibraryActivity {
  return {
    stage,
    state,
    startedAt: "2026-07-14T00:00:00Z",
    updatedAt: "2026-07-14T00:00:01Z",
    counts,
    ...(state === "failed" ? { reason: "operation_failed" } : {}),
  };
}

afterEach(cleanup);

describe("LibraryActivityPill", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<LibraryActivityPill activity={null} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ["filesystem_scan", { discovered: 42, reused: 30 }, "Scanning files - 42 discovered, 30 reused"],
    ["musicbrainz_resolution", { processed: 7, total: 20 }, "Resolving MusicBrainz - 7/20 processed"],
    ["musicbrainz_artist_metadata", { processed: 4, total: 12 }, "Updating artist metadata - 4/12 processed"],
    ["album_artwork", { attempted: 3, total: 10 }, "Finding album artwork - 3/10 attempted"],
    ["artist_artwork", { attempted: 2, total: 8 }, "Finding artist artwork - 2/8 attempted"],
  ] satisfies Array<[LibraryActivity["stage"], LibraryActivity["counts"], string]>) (
    "labels %s with compatible progress",
    (stage, counts, text) => {
      render(<LibraryActivityPill activity={activity(stage, counts)} />);
      const pill = screen.getByTitle(text);
      expect(pill.textContent).toContain(text);
      expect(pill.getAttribute("title")).toBe(text);
    },
  );

  it("announces only stable stage changes while visual progress keeps updating", () => {
    const { rerender } = render(<LibraryActivityPill activity={activity("filesystem_scan", { discovered: 1 })} />);
    const announcement = screen.getByRole("status");
    const pill = screen.getByTitle("Scanning files - 1 discovered");

    expect(announcement.getAttribute("aria-live")).toBe("polite");
    expect(announcement.textContent).toBe("Scanning files");
    expect(pill.getAttribute("role")).toBeNull();
    expect(pill.getAttribute("aria-live")).toBeNull();
    expect(pill.querySelector(".loading-spinner")).not.toBeNull();

    rerender(<LibraryActivityPill activity={activity("filesystem_scan", { discovered: 2 })} />);
    expect(screen.getByTitle("Scanning files - 2 discovered")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Scanning files");
  });

  it("shows a clear failed badge without a spinner", () => {
    render(<LibraryActivityPill activity={activity("album_artwork", { attempted: 3, total: 10 }, "failed")} />);
    const pill = screen.getByTitle("Album artwork failed");

    expect(pill.textContent).toContain("Album artwork failed");
    expect(pill.classList.contains("badge-error")).toBe(true);
    expect(pill.querySelector(".loading-spinner")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Album artwork failed");
  });

  it("keeps the noninteractive pill and descendants draggable", () => {
    render(<LibraryActivityPill activity={activity("filesystem_scan", { discovered: 1 })} />);
    const pill = screen.getByTitle("Scanning files - 1 discovered");

    expect(pill.getAttribute("data-tauri-drag-region")).not.toBeNull();
    for (const descendant of pill.querySelectorAll("*")) {
      expect(descendant.getAttribute("data-tauri-drag-region")).not.toBeNull();
    }
  });
});
