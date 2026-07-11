import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";
import { pickFolder } from "../Settings";

interface FsSource {
  configured: boolean;
  path?: string | null;
  scanning: boolean;
  lastScanAt?: string | null;
  lastScanError?: string | null;
}

interface LibrarySummary {
  counts: { artists?: number; albums?: number; tracks?: number };
}

export function Library({ admin, baseUrl }: { admin: AdminClient; baseUrl: string }) {
  const [source, setSource] = useState<FsSource | null>(null);
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setSource(await admin.get<FsSource>("/admin/api/source/filesystem"));
      setSummary(await admin.get<LibrarySummary>("/admin/api/state").then(() => null).catch(() => null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Poll while a scan runs so the counts settle.
  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (source?.scanning) void refresh();
    }, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.scanning]);

  async function choose() {
    const path = await pickFolder();
    if (!path) return;
    setError("");
    try {
      await admin.put("/admin/api/source/filesystem", { path });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the music folder.");
    }
  }

  async function rescan() {
    setError("");
    try {
      await admin.post("/admin/api/source/filesystem/scan");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the scan.");
    }
  }

  // The library counts come straight from /v1 on the player client; here we
  // just surface the source + scan health, which is the admin's concern.
  void summary;
  void baseUrl;

  return (
    <div className="settings-page">
      <div className="settings-head">Library</div>
      {error && <div className="modal-error">{error}</div>}
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Music folder</div>
            <div className="settings-row-desc">
              {source?.configured ? source.path : "No folder chosen yet — pick where your music lives."}
            </div>
          </div>
          <button type="button" className="settings-btn" onClick={() => void choose()}>
            {source?.configured ? "Change…" : "Choose…"}
          </button>
        </div>
        {source?.configured && (
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-label">Scan</div>
              <div className="settings-row-desc">
                {source.scanning
                  ? "Scanning your library…"
                  : source.lastScanError
                    ? `Last scan failed: ${source.lastScanError}`
                    : source.lastScanAt
                      ? `Last scanned ${new Date(source.lastScanAt).toLocaleString()}`
                      : "Not scanned yet."}
              </div>
            </div>
            <button type="button" className="settings-btn" disabled={source.scanning} onClick={() => void rescan()}>
              Rescan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
