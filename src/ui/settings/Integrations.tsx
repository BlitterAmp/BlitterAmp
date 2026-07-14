import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";
import type { DiscogsConfig, FanartConfig, Schemas } from "../../api/client";

type LidarrConfig = Schemas["LidarrConfig"];
type LastfmConfig = Schemas["LastfmConfig"];
type TestResult = Schemas["IntegrationTestResult"];
type Integration = "lidarr" | "lastfm" | "fanart" | "discogs";

export function Integrations({ admin }: { admin: AdminClient }) {
  const [lidarr, setLidarr] = useState<LidarrConfig | null>(null);
  const [lastfm, setLastfm] = useState<LastfmConfig | null>(null);
  const [fanart, setFanart] = useState<FanartConfig | null>(null);
  const [discogs, setDiscogs] = useState<DiscogsConfig | null>(null);
  const [lidarrForm, setLidarrForm] = useState({ baseUrl: "", apiKey: "" });
  const [lastfmForm, setLastfmForm] = useState({ apiKey: "", sharedSecret: "" });
  const [fanartApiKey, setFanartApiKey] = useState("");
  const [discogsPersonalToken, setDiscogsPersonalToken] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Integration, string>>>({});
  const [busy, setBusy] = useState<Integration | null>(null);
  const [confirmLastfmRemoval, setConfirmLastfmRemoval] = useState(false);

  async function refresh() {
    const load = async <T,>(key: Integration, path: string, setter: (value: T) => void) => {
      try {
        const value = await admin.get<T>(path);
        setter(value);
        setErrors((current) => ({ ...current, [key]: undefined }));
      } catch (err) {
        setErrors((current) => ({ ...current, [key]: errorMessage(err) }));
      }
    };
    await Promise.all([
      load<LidarrConfig>("lidarr", "/admin/api/integrations/lidarr", (value) => {
        setLidarr(value);
        if (value.baseUrl) setLidarrForm((form) => ({ ...form, baseUrl: value.baseUrl ?? "" }));
      }),
      load<LastfmConfig>("lastfm", "/admin/api/integrations/lastfm", setLastfm),
      load<FanartConfig>("fanart", "/admin/api/integrations/fanart", setFanart),
      load<DiscogsConfig>("discogs", "/admin/api/integrations/discogs", setDiscogs),
    ]);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap = (key: Integration, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(key);
    setErrors((current) => ({ ...current, [key]: undefined }));
    try {
      await fn();
    } catch (err) {
      setErrors((current) => ({ ...current, [key]: errorMessage(err) }));
    } finally {
      setBusy(null);
    }
  };

  const saveLidarr = async (e: React.FormEvent) => {
    e.preventDefault();
    setTest(null);
    await wrap("lidarr", async () => {
      await admin.put("/admin/api/integrations/lidarr", lidarrForm);
      setLidarrForm((f) => ({ ...f, apiKey: "" }));
      await refresh();
    })();
  };
  const testLidarr = wrap("lidarr", async () => setTest(await admin.post<TestResult>("/admin/api/integrations/lidarr/test")));
  const removeLidarr = wrap("lidarr", async () => {
    setTest(null);
    await admin.del("/admin/api/integrations/lidarr");
    await refresh();
  });
  const saveLastfm = async (e: React.FormEvent) => {
    e.preventDefault();
    await wrap("lastfm", async () => {
      await admin.put("/admin/api/integrations/lastfm", lastfmForm);
      setLastfmForm({ apiKey: "", sharedSecret: "" });
      await refresh();
    })();
  };
  const removeLastfm = wrap("lastfm", async () => {
    setConfirmLastfmRemoval(false);
    await admin.del("/admin/api/integrations/lastfm");
    await refresh();
  });
  const saveFanart = async (e: React.FormEvent) => {
    e.preventDefault();
    await wrap("fanart", async () => {
      await admin.put("/admin/api/integrations/fanart", { apiKey: fanartApiKey });
      setFanartApiKey("");
      await refresh();
    })();
  };
  const removeFanart = wrap("fanart", async () => {
    await admin.del("/admin/api/integrations/fanart");
    await refresh();
  });
  const saveDiscogs = async (e: React.FormEvent) => {
    e.preventDefault();
    await wrap("discogs", async () => {
      await admin.put("/admin/api/integrations/discogs", { personalToken: discogsPersonalToken });
      setDiscogsPersonalToken("");
      await refresh();
    })();
  };
  const removeDiscogs = wrap("discogs", async () => {
    await admin.del("/admin/api/integrations/discogs");
    await refresh();
  });

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Integrations</h3>
      <form className="mb-5 rounded-box bg-base-200 p-4" onSubmit={saveLidarr}>
        <div className="mb-2 flex items-center gap-2 font-medium">
          Lidarr
          <span className={`badge badge-sm ${lidarr?.configured ? "badge-success" : "badge-ghost"}`}>
            {lidarr?.configured ? "configured" : "off"}
          </span>
        </div>
        {errors.lidarr && <div className="alert alert-error mb-2 text-sm">Lidarr: {errors.lidarr}</div>}
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
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy !== null || !lidarrForm.baseUrl || !lidarrForm.apiKey}>Save</button>
          {lidarr?.configured && (
            <>
              <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => void testLidarr()}>Test</button>
              <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy !== null} onClick={() => void removeLidarr()}>Remove</button>
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
        {lastfm?.configured && <p className="mb-2 text-sm opacity-70">{lastfm.connectedProfiles ?? 0} connected profile{lastfm.connectedProfiles === 1 ? "" : "s"}.</p>}
        {errors.lastfm && <div className="alert alert-error mb-2 text-sm">last.fm: {errors.lastfm}</div>}
        <div className="mb-2 flex gap-2">
          <input className="input input-sm input-bordered flex-1" type="password" placeholder="API key" value={lastfmForm.apiKey} onChange={(e) => setLastfmForm({ ...lastfmForm, apiKey: e.target.value })} />
          <input className="input input-sm input-bordered flex-1" type="password" placeholder="Shared secret" value={lastfmForm.sharedSecret} onChange={(e) => setLastfmForm({ ...lastfmForm, sharedSecret: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy !== null || !lastfmForm.apiKey || !lastfmForm.sharedSecret} aria-label="Save last.fm">Save</button>
          {lastfm?.configured && (
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy !== null} onClick={() => setConfirmLastfmRemoval(true)} aria-label="Remove last.fm">Remove</button>
          )}
        </div>
      </form>

      {confirmLastfmRemoval && (
        <dialog open className="modal modal-open" aria-labelledby="remove-lastfm-heading">
          <div className="modal-box">
            <h3 id="remove-lastfm-heading" className="text-lg font-semibold">Remove last.fm credentials?</h3>
            <p className="mt-3 text-sm">
              Removing the instance credentials will disconnect all{(lastfm?.connectedProfiles ?? 0) > 0 ? ` ${lastfm?.connectedProfiles} connected profiles` : " connected profiles"} and delete their personal last.fm linkage.
            </p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmLastfmRemoval(false)}>Cancel</button>
              <button type="button" className="btn btn-error" onClick={() => void removeLastfm()}>Remove credentials</button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setConfirmLastfmRemoval(false)} aria-label="Cancel">close</button>
        </dialog>
      )}

      <form className="mb-5 rounded-box bg-base-200 p-4" onSubmit={saveDiscogs}>
        <div className="mb-2 flex items-center gap-2 font-medium">
          Discogs
          <span className={`badge badge-sm ${discogs?.configured ? "badge-success" : "badge-ghost"}`}>
            {discogs?.configured ? "configured" : "off"}
          </span>
        </div>
        {errors.discogs && <div className="alert alert-error mb-2 text-sm">Discogs: {errors.discogs}</div>}
        <p className="mb-2 text-sm opacity-70">Supplies album and artist artwork as a fallback during library enrichment.</p>
        <div className="mb-2 flex gap-2">
          <input
            className="input input-sm input-bordered flex-1"
            type="password"
            autoComplete="off"
            placeholder="Discogs personal access token"
            value={discogsPersonalToken}
            onChange={(e) => setDiscogsPersonalToken(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy !== null || !discogsPersonalToken} aria-label="Save Discogs">Save</button>
          {discogs?.configured && (
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy !== null} onClick={() => void removeDiscogs()} aria-label="Remove Discogs">Remove</button>
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
        {errors.fanart && <div className="alert alert-error mb-2 text-sm">fanart.tv: {errors.fanart}</div>}
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
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy !== null || !fanartApiKey} aria-label="Save fanart.tv">Save</button>
          {fanart?.configured && (
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy !== null} onClick={() => void removeFanart()} aria-label="Remove fanart.tv">Remove</button>
          )}
        </div>
      </form>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Request failed. Check the server and try again.";
}
