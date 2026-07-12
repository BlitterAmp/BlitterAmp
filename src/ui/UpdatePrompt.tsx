import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

// Checks for an update on launch and, if one is available, offers a
// non-intrusive toast to install + restart. In dev (unpackaged, no updater
// endpoint) check() rejects — swallowed, so nothing shows.
export function UpdatePrompt() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let alive = true;
    check()
      .then((u) => {
        if (alive && u?.available) setUpdate(u);
      })
      .catch(() => {
        /* not packaged / offline / no release yet — stay silent */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!update) return null;

  async function install() {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setInstalling(false);
    }
  }

  return (
    <div className="toast toast-end toast-bottom z-50">
      <div className="alert flex-row items-center gap-3 shadow-lg">
        <div>
          <div className="font-semibold">Update available</div>
          <div className="text-xs opacity-70">Version {update.version}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUpdate(null)} disabled={installing}>
            Later
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={install} disabled={installing}>
            {installing ? <span className="loading loading-spinner loading-xs" /> : "Install & Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}
