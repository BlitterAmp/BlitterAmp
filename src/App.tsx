import { useEffect, useMemo, useState } from "react";
import { Player } from "./audio/player";
import { TauriAudioBackend } from "./audio/tauriBackend";
import { type Connection, resolveConnection } from "./state/connection";
import { LibraryProvider } from "./state/library";
import { Shell } from "./ui/Shell";

type Phase =
  | { name: "splash" }
  | { name: "app"; connection: Connection }
  | { name: "error"; message: string };

// Deduped bootstrap. React StrictMode double-mounts in dev, so the boot effect
// runs twice; without this both calls would fire engine_start, spawning two
// sidecars that fight over the same SQLite data dir. Sharing the in-flight
// promise starts the engine exactly once; cleared on failure so Retry works.
let bootInflight: Promise<Connection> | null = null;
function bootConnection(): Promise<Connection> {
  if (!bootInflight) {
    bootInflight = resolveConnection();
    bootInflight.catch(() => {
      bootInflight = null;
    });
  }
  return bootInflight;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "splash" });

  async function boot() {
    setPhase({ name: "splash" });
    try {
      setPhase({ name: "app", connection: await bootConnection() });
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connection = phase.name === "app" ? phase.connection : null;
  const player = useMemo(
    () => (connection ? new Player(connection.client, new TauriAudioBackend()) : null),
    [connection?.client],
  );


  if (phase.name === "splash") {
    return (
      <div className="flex h-screen items-center justify-center bg-base-200" data-tauri-drag-region>
        <div className="brand animate-pulse text-6xl">
          Blitter<span>Amp</span>
        </div>
      </div>
    );
  }

  if (phase.name === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-base-200 p-8" data-tauri-drag-region>
        <div className="brand text-4xl">
          Blitter<span>Amp</span>
        </div>
        <div className="alert alert-error max-w-md">
          <div>
            <div className="font-semibold">Couldn't start the built-in music server</div>
            <div className="text-sm opacity-80">{phase.message}</div>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void boot()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <LibraryProvider connection={phase.connection}>
      <Shell
        connection={phase.connection}
        player={player as Player}
        onConnectionChange={(c) => setPhase({ name: "app", connection: c })}
      />
    </LibraryProvider>
  );
}
