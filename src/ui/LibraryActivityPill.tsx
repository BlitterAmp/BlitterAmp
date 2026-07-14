import type { LibraryActivity } from "../api/client";

const runningLabels: Record<LibraryActivity["stage"], string> = {
  filesystem_scan: "Scanning files",
  musicbrainz_resolution: "Resolving MusicBrainz",
  musicbrainz_artist_metadata: "Updating artist metadata",
  album_artwork: "Finding album artwork",
  artist_artwork: "Finding artist artwork",
};

const failedLabels: Record<LibraryActivity["stage"], string> = {
  filesystem_scan: "Filesystem scan failed",
  musicbrainz_resolution: "MusicBrainz resolution failed",
  musicbrainz_artist_metadata: "Artist metadata failed",
  album_artwork: "Album artwork failed",
  artist_artwork: "Artist artwork failed",
};

function ratio(value: number | undefined, total: number | undefined, noun: string): string | null {
  if (value === undefined) return null;
  return total === undefined ? `${value} ${noun}` : `${value}/${total} ${noun}`;
}

function progress(activity: LibraryActivity): string | null {
  const { counts } = activity;
  switch (activity.stage) {
    case "filesystem_scan": {
      const parts = [
        counts.discovered === undefined ? null : `${counts.discovered} discovered`,
        counts.reused === undefined ? null : `${counts.reused} reused`,
      ].filter((part): part is string => part !== null);
      return parts.length ? parts.join(", ") : null;
    }
    case "musicbrainz_resolution":
    case "musicbrainz_artist_metadata":
      return ratio(counts.processed, counts.total, "processed");
    case "album_artwork":
    case "artist_artwork":
      return ratio(counts.attempted, counts.total, "attempted");
  }
}

/** Displays the current server-reported library pipeline activity. */
export function LibraryActivityPill({ activity }: { activity?: LibraryActivity | null }) {
  if (!activity) return null;

  const isRunning = activity.state === "running";
  const detail = isRunning ? progress(activity) : null;
  const announcement = isRunning ? runningLabels[activity.stage] : failedLabels[activity.stage];
  const text = isRunning
    ? `${runningLabels[activity.stage]}${detail ? ` - ${detail}` : ""}`
    : failedLabels[activity.stage];

  return (
    <>
      <div
        className={`badge badge-sm min-w-0 max-w-56 gap-1 ${isRunning ? "badge-primary" : "badge-error"}`}
        title={text}
        data-tauri-drag-region
      >
        {isRunning && (
          <span
            className="loading loading-spinner loading-xs shrink-0"
            aria-hidden="true"
            data-tauri-drag-region
          />
        )}
        <span className="min-w-0 truncate" data-tauri-drag-region>
          {text}
        </span>
      </div>
      <span
        key={announcement}
        className="sr-only"
        role="status"
        aria-live="polite"
        data-tauri-drag-region
      >
        {announcement}
      </span>
    </>
  );
}
