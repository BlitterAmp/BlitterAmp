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

export function Library({ admin }: { admin: AdminClient; baseUrl: string }) {
  const [source, setSource] = useState<FsSource | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setSource(await admin.get<FsSource>("/admin/api/source/filesystem"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

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

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Library</h3>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-box bg-base-200 p-4">
          <div className="min-w-0">
            <div className="font-medium">Music folder</div>
            <div className="truncate text-sm opacity-70">
              {source?.configured ? source.path : "No folder chosen yet — pick where your music lives."}
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void choose()}>
            {source?.configured ? "Change…" : "Choose…"}
          </button>
        </div>
        {source?.configured && (
          <div className="flex items-center justify-between rounded-box bg-base-200 p-4">
            <div>
              <div className="font-medium">Scan</div>
              <div className="text-sm opacity-70">
                {source.scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs" /> Scanning your library…
                  </span>
                ) : source.lastScanError ? (
                  <span className="text-error">Last scan failed: {source.lastScanError}</span>
                ) : source.lastScanAt ? (
                  `Last scanned ${new Date(source.lastScanAt).toLocaleString()}`
                ) : (
                  "Not scanned yet."
                )}
              </div>
            </div>
            <button type="button" className="btn btn-sm" disabled={source.scanning} onClick={() => void rescan()}>
              Rescan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
