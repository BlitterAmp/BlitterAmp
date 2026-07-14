import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Client, ServerStatus } from "../api/client";

// Activity is short-lived enough for a responsive cadence; idle and failed
// states back off to limit routine traffic against remote servers.
const ACTIVE_POLL_INTERVAL_MS = 2_000;
const IDLE_POLL_INTERVAL_MS = 5_000;
const STATUS_REQUEST_TIMEOUT_MS = 10_000;

const StatusContext = createContext<ServerStatus | null>(null);
const requests = new WeakMap<Client, Promise<ServerStatus>>();

function requestStatus(client: Client): Promise<ServerStatus> {
  const existing = requests.get(client);
  if (existing) return existing;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const request = new Promise<ServerStatus>((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException("Status request timed out", "AbortError"));
    }, STATUS_REQUEST_TIMEOUT_MS);
    void client.status(controller.signal).then(resolve, reject);
  });
  const tracked = request.finally(() => {
    clearTimeout(timer);
    if (requests.get(client) === tracked) requests.delete(client);
  });
  requests.set(client, tracked);
  return tracked;
}

/** Shares one adaptive server-status polling stream for a connected client. */
export function ServerStatusProvider({ client, children }: { client: Client; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<{ client: Client; status: ServerStatus | null }>({ client, status: null });

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot({ client, status: null });

    const poll = async () => {
      let next: ServerStatus | null = null;
      try {
        next = await requestStatus(client);
      } catch {
        // A status failure is transient and must not affect connection choice.
      }
      if (!current) return;

      setSnapshot({ client, status: next });
      const interval = next?.activity?.state === "running" ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
      timer = setTimeout(() => void poll(), interval);
    };

    void poll();
    return () => {
      current = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [client]);

  const status = snapshot.client === client ? snapshot.status : null;
  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>;
}

/** Returns the latest status, or null before a response and after transport/API failure. */
export function useServerStatus(): ServerStatus | null {
  return useContext(StatusContext);
}
