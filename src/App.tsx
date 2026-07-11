import { useEffect, useMemo, useState } from "react";
import { Player } from "./audio/player";
import { type Connection, resolveConnection } from "./state/connection";
import { Shell } from "./ui/Shell";

type Phase =
  | { name: "splash" }
  | { name: "app"; connection: Connection }
  | { name: "error"; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "splash" });

  async function boot() {
    setPhase({ name: "splash" });
    try {
      const connection = await resolveConnection();
      setPhase({ name: "app", connection });
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connection = phase.name === "app" ? phase.connection : null;
  const player = useMemo(() => (connection ? new Player(connection.client) : null), [connection?.client]);

  if (phase.name === "splash") {
    return (
      <div className="signin-screen" data-tauri-drag-region>
        <div className="splash-logo brand">
          Blitter<span>Amp</span>
        </div>
      </div>
    );
  }

  if (phase.name === "error") {
    return (
      <div className="signin-screen" data-tauri-drag-region>
        <div className="signin-logo brand">
          Blitter<span>Amp</span>
        </div>
        <div className="signin-error">Couldn't start the built-in music server:</div>
        <div className="signin-hint">{phase.message}</div>
        <button type="button" className="signin-btn" onClick={() => void boot()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <Shell
      connection={phase.connection}
      player={player as Player}
      onConnectionChange={(c) => setPhase({ name: "app", connection: c })}
    />
  );
}
