import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import type { Client, LastfmAccount as LastfmAccountState, LastfmConnect } from "../../api/client";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 30;
const POLL_DEADLINE_MS = 90_000;

export function LastfmAccount({ client }: { client: Client }) {
  const [status, setStatus] = useState<LastfmAccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);
  const generation = useRef(0);
  const pollDeadline = useRef(0);

  async function refresh(showLoading = false, expectedGeneration = ++generation.current): Promise<LastfmAccountState | null> {
    setBusy(false);
    if (showLoading) {
      setLoading(true);
      setPollExhausted(false);
    }
    setError("");
    try {
      const next = await client.get<LastfmAccountState>("/v1/me/lastfm");
      if (generation.current !== expectedGeneration) return null;
      setStatus(next);
      if (next.connected) setPolling(false);
      return next;
    } catch (err) {
      if (generation.current !== expectedGeneration) return null;
      setError(message(err, "Could not check your last.fm account. Check the server connection and try again."));
      return null;
    } finally {
      if (showLoading && generation.current === expectedGeneration) setLoading(false);
    }
  }

  useEffect(() => {
    const expectedGeneration = ++generation.current;
    setStatus(null);
    setLoading(true);
    setError("");
    setPolling(false);
    setPollExhausted(false);
    setBusy(false);
    void refresh(true, expectedGeneration);
    return () => {
      generation.current += 1;
    };
    // The client changes only when the active connection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const stop = (exhausted = false) => {
      if (!cancelled) {
        setPolling(false);
        setPollExhausted(exhausted);
      }
    };

    const schedule = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const remaining = pollDeadline.current - Date.now();
      if (remaining <= 0 || attempts >= MAX_POLL_ATTEMPTS) return stop(true);
      timer = setTimeout(poll, Math.min(POLL_INTERVAL_MS, remaining));
    };

    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() >= pollDeadline.current || attempts >= MAX_POLL_ATTEMPTS) return stop(true);
      attempts += 1;
      const expectedGeneration = ++generation.current;
      const next = await refresh(false, expectedGeneration);
      if (cancelled || generation.current !== expectedGeneration) return;
      if (next?.connected) return stop();
      schedule();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = undefined;
      void poll();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // refresh deliberately reads the current client from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, client]);

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    const expectedGeneration = ++generation.current;
    try {
      const { url } = await client.post<LastfmConnect>("/v1/me/lastfm/connect");
      if (generation.current !== expectedGeneration) return;
      validateAuthorizationUrl(url);
      await openUrl(url);
      if (generation.current !== expectedGeneration) return;
      pollDeadline.current = Date.now() + POLL_DEADLINE_MS;
      setPollExhausted(false);
      setPolling(true);
    } catch (err) {
      if (generation.current !== expectedGeneration) return;
      setError(message(err, "Could not start last.fm authorization. Try again or ask the server administrator to check its last.fm credentials."));
    } finally {
      if (generation.current === expectedGeneration) setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError("");
    const expectedGeneration = ++generation.current;
    try {
      await client.del("/v1/me/lastfm");
      if (generation.current !== expectedGeneration) return;
      setStatus((current) => current ? { ...current, connected: false, username: null } : current);
      setPolling(false);
      setPollExhausted(false);
    } catch (err) {
      if (generation.current !== expectedGeneration) return;
      setError(message(err, "Could not disconnect last.fm. Check the server connection and try again."));
    } finally {
      if (generation.current === expectedGeneration) setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-box bg-base-200 p-4" aria-labelledby="lastfm-account-heading">
      <div className="mb-2 flex items-center gap-2">
        <h4 id="lastfm-account-heading" className="font-medium">Your last.fm account</h4>
        {!loading && status && (
          <span className={`badge badge-sm ${status.connected ? "badge-success" : "badge-ghost"}`}>
            {status.connected ? "connected" : "not connected"}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70"><span className="loading loading-spinner loading-xs" />Checking account status...</div>
      ) : !status ? (
        <p className="text-sm opacity-70">Account status is unavailable.</p>
      ) : !status.available ? (
        <p className="text-sm opacity-70">This server has no last.fm API credentials. Ask its administrator to configure last.fm before connecting a personal account.</p>
      ) : status.connected ? (
        <p className="text-sm">Connected as <strong>{status.username || "your last.fm account"}</strong>.</p>
      ) : (
        <p className="text-sm opacity-70">Connect your account to scrobble listening activity through this server.</p>
      )}
      {polling && <p className="mt-2 text-sm text-info">Waiting for authorization to complete...</p>}
      {pollExhausted && <p className="mt-2 text-sm opacity-70">Authorization was not observed. Use Refresh to check again.</p>}
      {error && <div className="alert alert-error mt-3 text-sm">{error}</div>}
      <div className="mt-3 flex gap-2">
        {status?.available && !status.connected && (
          <button type="button" className="btn btn-sm btn-primary" disabled={busy || polling} onClick={() => void connect()}>
            {busy ? "Opening..." : "Connect"}
          </button>
        )}
        {status?.connected && (
          <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy} onClick={() => void disconnect()}>
            {busy ? "Disconnecting..." : "Disconnect"}
          </button>
        )}
        <button type="button" className="btn btn-sm" disabled={loading} onClick={() => void refresh(true)}>Refresh</button>
      </div>
    </section>
  );
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}

function validateAuthorizationUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Refused the malformed authorization URL returned by the server for safety.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.last.fm" ||
    url.port !== "" ||
    url.pathname !== "/api/auth/" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error("Refused the unexpected last.fm authorization URL returned by the server for safety.");
  }
}
