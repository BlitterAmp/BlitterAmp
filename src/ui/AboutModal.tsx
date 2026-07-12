import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import llamaSound from "../../assets/blitteramp_llama.mp3?url";

// About window: brand, version, license, and a searchable acknowledgements list
// of every dependency that ships — npm (the webview bundle) and the Rust crates
// linked into the host binary. The manifest (generated/licenses.json, built by
// `pnpm gen:licenses`) is dynamically imported so its ~120KB stays out of the
// startup bundle.

interface LicenseEntry {
  ecosystem: "npm" | "rust";
  name: string;
  version: string;
  license: string;
  homepage: string | null;
  description: string | null;
}

const REPO = "https://github.com/BlitterAmp/BlitterAmp";
const MIT = "https://opensource.org/license/mit";
let llamaAudio: HTMLAudioElement | null = null;
let llamaPlaying = false;

function link(url: string | null) {
  if (url) void openUrl(url);
}

function playLlamaSound() {
  if (llamaPlaying) return;

  if (!llamaAudio) {
    llamaAudio = new Audio(llamaSound);
    const reset = () => {
      llamaPlaying = false;
    };
    llamaAudio.addEventListener("ended", reset);
    llamaAudio.addEventListener("error", reset);
  }

  llamaPlaying = true;
  try {
    void llamaAudio.play().catch(() => {
      llamaPlaying = false;
    });
  } catch {
    llamaPlaying = false;
  }
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  const [deps, setDeps] = useState<LicenseEntry[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    void import("../generated/licenses.json").then((m) => {
      if (alive) setDeps(m.default as LicenseEntry[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!deps) return [];
    const q = query.trim().toLowerCase();
    if (!q) return deps;
    return deps.filter(
      (d) => d.name.toLowerCase().includes(q) || d.license.toLowerCase().includes(q),
    );
  }, [deps, query]);

  return (
    <dialog className="modal modal-open" onClose={onClose}>
      <div className="modal-box flex max-h-[85vh] max-w-2xl flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
          <h2 className="text-lg font-semibold">About</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Identity */}
        <div className="flex flex-col items-center gap-1 px-6 pt-6 text-center">
          <button
            type="button"
            className="brand cursor-pointer border-0 bg-transparent p-0 text-4xl"
            aria-label="Play BlitterAmp sound"
            onClick={playLlamaSound}
          >
            Blitter<span>Amp</span>
          </button>
          <div className="text-sm text-base-content/60">Version {__APP_VERSION__}</div>
          <div className="mt-2 text-sm text-base-content/70">
            © 2026 Nathan Ollerenshaw · Released under the{" "}
            <button type="button" className="link link-primary" onClick={() => link(MIT)}>
              MIT License
            </button>
          </div>
          <button type="button" className="link link-hover text-sm text-base-content/60" onClick={() => link(REPO)}>
            github.com/BlitterAmp/BlitterAmp
          </button>
        </div>

        {/* Acknowledgements */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-base-300 px-6 pt-4">
          <div>
            <div className="text-sm font-semibold">Acknowledgements</div>
            <div className="text-xs text-base-content/50">
              {deps ? `${deps.length} open-source projects` : "Loading…"}
            </div>
          </div>
          <input
            type="search"
            className="input input-sm input-bordered w-44"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <p className="mb-3 text-xs text-base-content/50">
            BlitterAmp is built on these projects. Thank you to their authors and contributors.
          </p>
          <ul className="flex flex-col gap-1.5">
            {filtered.map((d) => (
              <li key={`${d.ecosystem}:${d.name}`} className="rounded-lg bg-base-200/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`badge badge-xs ${d.ecosystem === "rust" ? "badge-warning" : "badge-info"}`}>
                    {d.ecosystem}
                  </span>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-base-content/50">{d.version}</span>
                  <span className="badge badge-ghost badge-xs">{d.license}</span>
                  {d.homepage && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle text-base-content/50"
                      title={d.homepage}
                      onClick={() => link(d.homepage)}
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
                {d.description && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-base-content/60">{d.description}</div>
                )}
              </li>
            ))}
            {deps && filtered.length === 0 && (
              <li className="py-4 text-center text-sm text-base-content/50">No matches for “{query}”.</li>
            )}
          </ul>
        </div>
      </div>
      {/* Backdrop click-to-close */}
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close">
        close
      </button>
    </dialog>
  );
}
