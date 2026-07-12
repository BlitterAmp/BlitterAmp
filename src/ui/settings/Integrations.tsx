import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";

interface LidarrConfig { configured: boolean; baseUrl?: string | null; apiKeySet?: boolean; }
interface LastfmConfig { configured: boolean; }
interface FanartConfig { configured: boolean; }
interface TestResult { ok: boolean; version?: string | null; error?: string | null; }

export function Integrations({ admin }: { admin: AdminClient }) {
  const [lidarr, setLidarr] = useState<LidarrConfig | null>(null);
  const [lastfm, setLastfm] = useState<LastfmConfig | null>(null);
  const [fanart, setFanart] = useState<FanartConfig | null>(null);
  const [lidarrForm, setLidarrForm] = useState({ baseUrl: "", apiKey: "" });
  const [lastfmForm, setLastfmForm] = useState({ apiKey: "", sharedSecret: "" });
  const [fanartApiKey, setFanartApiKey] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const l = await admin.get<LidarrConfig>("/admin/api/integrations/lidarr");
      setLidarr(l);
      if (l.baseUrl) setLidarrForm((f) => ({ ...f, baseUrl: l.baseUrl ?? "" }));
      setLastfm(await admin.get<LastfmConfig>("/admin/api/integrations/lastfm"));
      setFanart(await admin.get<FanartConfig>("/admin/api/integrations/fanart"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap = (fn: () => Promise<void>) => async () => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveLidarr = async (e: React.FormEvent) => {
    e.preventDefault();
    setTest(null);
    await wrap(async () => {
      await admin.put("/admin/api/integrations/lidarr", lidarrForm);
      setLidarrForm((f) => ({ ...f, apiKey: "" }));
      await refresh();
    })();
  };
  const testLidarr = wrap(async () => setTest(await admin.post<TestResult>("/admin/api/integrations/lidarr/test")));
  const removeLidarr = wrap(async () => {
    setTest(null);
    await admin.del("/admin/api/integrations/lidarr");
    await refresh();
  });
  const saveLastfm = async (e: React.FormEvent) => {
    e.preventDefault();
    await wrap(async () => {
      await admin.put("/admin/api/integrations/lastfm", lastfmForm);
      setLastfmForm({ apiKey: "", sharedSecret: "" });
      await refresh();
    })();
  };
  const removeLastfm = wrap(async () => {
    await admin.del("/admin/api/integrations/lastfm");
    await refresh();
  });
  const saveFanart = async (e: React.FormEvent) => {
    e.preventDefault();
    await wrap(async () => {
      await admin.put("/admin/api/integrations/fanart", { apiKey: fanartApiKey });
      setFanartApiKey("");
      await refresh();
    })();
  };
  const removeFanart = wrap(async () => {
    await admin.del("/admin/api/integrations/fanart");
    await refresh();
  });

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Integrations</h3>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <form className="mb-5 rounded-box bg-base-200 p-4" onSubmit={saveLidarr}>
        <div className="mb-2 flex items-center gap-2 font-medium">
          Lidarr
          <span className={`badge badge-sm ${lidarr?.configured ? "badge-success" : "badge-ghost"}`}>
            {lidarr?.configured ? "configured" : "off"}
          </span>
        </div>
        <div className="mb-2 flex gap-2">
          <input className="input input-sm input-bordered flex-1" placeholder="http://192.168.1.5:8686" value={lidarrForm.baseUrl} onChange={(e) => setLidarrForm({ ...lidarrForm, baseUrl: e.target.value })} />
          <input className="input input-sm input-bordered flex-1" type="password" placeholder={lidarr?.apiKeySet ? "API key (set — replace)" : "API key"} value={lidarrForm.apiKey} onChange={(e) => setLidarrForm({ ...lidarrForm, apiKey: e.target.value })} />
        </div>
        {test && (
          <div className={`mb-2 text-sm ${test.ok ? "text-success" : "text-error"}`}>
            {test.ok ? `Connected${test.version ? ` — Lidarr ${test.version}` : ""}.` : test.error}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={!lidarrForm.baseUrl || !lidarrForm.apiKey}>Save</button>
          {lidarr?.configured && (
            <>
              <button type="button" className="btn btn-sm" onClick={() => void testLidarr()}>Test</button>
              <button type="button" className="btn btn-sm btn-error btn-outline" onClick={() => void removeLidarr()}>Remove</button>
            </>
          )}
        </div>
      </form>

      <form className="mb-5 rounded-box bg-base-200 p-4" onSubmit={saveLastfm}>
        <div className="mb-2 flex items-center gap-2 font-medium">
          last.fm
          <span className={`badge badge-sm ${lastfm?.configured ? "badge-success" : "badge-ghost"}`}>
            {lastfm?.configured ? "configured" : "off"}
          </span>
        </div>
        <div className="mb-2 flex gap-2">
          <input className="input input-sm input-bordered flex-1" type="password" placeholder="API key" value={lastfmForm.apiKey} onChange={(e) => setLastfmForm({ ...lastfmForm, apiKey: e.target.value })} />
          <input className="input input-sm input-bordered flex-1" type="password" placeholder="Shared secret" value={lastfmForm.sharedSecret} onChange={(e) => setLastfmForm({ ...lastfmForm, sharedSecret: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={!lastfmForm.apiKey || !lastfmForm.sharedSecret}>Save</button>
          {lastfm?.configured && (
            <button type="button" className="btn btn-sm btn-error btn-outline" onClick={() => void removeLastfm()}>Remove</button>
          )}
        </div>
      </form>

      <form className="rounded-box bg-base-200 p-4" onSubmit={saveFanart}>
        <div className="mb-2 flex items-center gap-2 font-medium">
          fanart.tv
          <span className={`badge badge-sm ${fanart?.configured ? "badge-success" : "badge-ghost"}`}>
            {fanart?.configured ? "configured" : "off"}
          </span>
        </div>
        <p className="mb-2 text-sm opacity-70">Supplies artist photos and additional artwork during library enrichment.</p>
        <div className="mb-2 flex gap-2">
          <input
            className="input input-sm input-bordered flex-1"
            type="password"
            placeholder="fanart.tv API key"
            value={fanartApiKey}
            onChange={(e) => setFanartApiKey(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={!fanartApiKey} aria-label="Save fanart.tv">Save</button>
          {fanart?.configured && (
            <button type="button" className="btn btn-sm btn-error btn-outline" onClick={() => void removeFanart()} aria-label="Remove fanart.tv">Remove</button>
          )}
        </div>
      </form>
    </div>
  );
}
