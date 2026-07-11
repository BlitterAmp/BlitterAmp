import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";

interface LidarrConfig {
  configured: boolean;
  baseUrl?: string | null;
  apiKeySet?: boolean;
}
interface LastfmConfig {
  configured: boolean;
}
interface TestResult {
  ok: boolean;
  version?: string | null;
  error?: string | null;
}

export function Integrations({ admin }: { admin: AdminClient }) {
  const [lidarr, setLidarr] = useState<LidarrConfig | null>(null);
  const [lastfm, setLastfm] = useState<LastfmConfig | null>(null);
  const [lidarrForm, setLidarrForm] = useState({ baseUrl: "", apiKey: "" });
  const [lastfmForm, setLastfmForm] = useState({ apiKey: "", sharedSecret: "" });
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const l = await admin.get<LidarrConfig>("/admin/api/integrations/lidarr");
      setLidarr(l);
      if (l.baseUrl) setLidarrForm((f) => ({ ...f, baseUrl: l.baseUrl ?? "" }));
      setLastfm(await admin.get<LastfmConfig>("/admin/api/integrations/lastfm"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLidarr(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTest(null);
    try {
      await admin.put("/admin/api/integrations/lidarr", lidarrForm);
      setLidarrForm((f) => ({ ...f, apiKey: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function testLidarr() {
    setError("");
    try {
      setTest(await admin.post<TestResult>("/admin/api/integrations/lidarr/test"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeLidarr() {
    setTest(null);
    try {
      await admin.del("/admin/api/integrations/lidarr");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveLastfm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await admin.put("/admin/api/integrations/lastfm", lastfmForm);
      setLastfmForm({ apiKey: "", sharedSecret: "" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeLastfm() {
    try {
      await admin.del("/admin/api/integrations/lastfm");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">Integrations</div>
      {error && <div className="modal-error">{error}</div>}

      <form className="settings-section" onSubmit={saveLidarr}>
        <div className="settings-section-title">Lidarr {lidarr?.configured ? "· configured" : ""}</div>
        <div className="settings-row" style={{ gap: 8 }}>
          <input
            className="settings-input"
            placeholder="http://192.168.1.5:8686"
            value={lidarrForm.baseUrl}
            onChange={(e) => setLidarrForm({ ...lidarrForm, baseUrl: e.target.value })}
          />
          <input
            className="settings-input"
            type="password"
            placeholder={lidarr?.apiKeySet ? "API key (set — replace)" : "API key"}
            value={lidarrForm.apiKey}
            onChange={(e) => setLidarrForm({ ...lidarrForm, apiKey: e.target.value })}
          />
        </div>
        {test && (
          <div className={`settings-row-desc ${test.ok ? "" : "modal-error"}`} style={{ padding: "0 0 8px" }}>
            {test.ok ? `Connected${test.version ? ` — Lidarr ${test.version}` : ""}.` : test.error}
          </div>
        )}
        <div className="settings-row" style={{ gap: 6 }}>
          <button type="submit" className="settings-btn modal-create" disabled={!lidarrForm.baseUrl || !lidarrForm.apiKey}>
            Save
          </button>
          {lidarr?.configured && (
            <>
              <button type="button" className="settings-btn" onClick={() => void testLidarr()}>
                Test
              </button>
              <button type="button" className="settings-btn danger" onClick={() => void removeLidarr()}>
                Remove
              </button>
            </>
          )}
        </div>
      </form>

      <form className="settings-section" onSubmit={saveLastfm}>
        <div className="settings-section-title">last.fm {lastfm?.configured ? "· configured" : ""}</div>
        <div className="settings-row" style={{ gap: 8 }}>
          <input
            className="settings-input"
            type="password"
            placeholder="API key"
            value={lastfmForm.apiKey}
            onChange={(e) => setLastfmForm({ ...lastfmForm, apiKey: e.target.value })}
          />
          <input
            className="settings-input"
            type="password"
            placeholder="Shared secret"
            value={lastfmForm.sharedSecret}
            onChange={(e) => setLastfmForm({ ...lastfmForm, sharedSecret: e.target.value })}
          />
        </div>
        <div className="settings-row" style={{ gap: 6 }}>
          <button type="submit" className="settings-btn modal-create" disabled={!lastfmForm.apiKey || !lastfmForm.sharedSecret}>
            Save
          </button>
          {lastfm?.configured && (
            <button type="button" className="settings-btn danger" onClick={() => void removeLastfm()}>
              Remove
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
