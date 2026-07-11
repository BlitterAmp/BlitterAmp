import { useEffect, useMemo, useState } from "react";
import { Client } from "./api/client";
import { Player } from "./audio/player";
import { startEngine } from "./state/engine";
import {
  DEFAULT_LOCAL_URL,
  lastServerUrl,
  loadSession,
  probeRemote,
  restore,
  saveManagedMarker,
  type Restored,
} from "./state/session";
import { Shell } from "./ui/Shell";
import { SignIn } from "./ui/SignIn";

type Phase =
  | { name: "splash" }
  | { name: "signin"; initialUrl: string; device?: Extract<Restored, { kind: "device" }>; error?: string }
  | { name: "app"; client: Client; profileName: string; managed?: boolean };

function engineError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `Couldn't start the built-in server: ${msg}`;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "splash" });

  useEffect(() => {
    void (async () => {
      const saved = await loadSession();

      // Adopted the bundled engine already: start it and go.
      if (saved?.managed) {
        try {
          const { client, info } = await startEngine();
          await saveManagedMarker(info.profile_name);
          setPhase({ name: "app", client, profileName: info.profile_name, managed: true });
          return;
        } catch (err) {
          setPhase({ name: "signin", initialUrl: DEFAULT_LOCAL_URL, error: engineError(err) });
          return;
        }
      }

      // A saved remote session that still works.
      const restored = await restore();
      if (restored.kind === "profile") {
        setPhase({ name: "app", client: restored.client, profileName: restored.session.profile?.name ?? "" });
        return;
      }
      if (restored.kind === "device") {
        const initialUrl = await lastServerUrl();
        setPhase({ name: "signin", initialUrl, device: restored });
        return;
      }

      // Nothing saved. Prefer a server the user is already running, else
      // start our own bundled engine.
      if (await probeRemote(DEFAULT_LOCAL_URL)) {
        setPhase({ name: "signin", initialUrl: DEFAULT_LOCAL_URL });
        return;
      }
      try {
        const { client, info } = await startEngine();
        await saveManagedMarker(info.profile_name);
        setPhase({ name: "app", client, profileName: info.profile_name, managed: true });
      } catch (err) {
        setPhase({ name: "signin", initialUrl: DEFAULT_LOCAL_URL, error: engineError(err) });
      }
    })();
  }, []);

  const client = phase.name === "app" ? phase.client : null;
  const player = useMemo(() => (client ? new Player(client) : null), [client]);

  if (phase.name === "splash") {
    return (
      <div className="signin-screen">
        <div className="splash-logo brand">
          Blitter<span>Amp</span>
        </div>
      </div>
    );
  }

  if (phase.name === "signin") {
    return (
      <SignIn
        initialUrl={phase.initialUrl}
        initialError={phase.error}
        initialDevice={
          phase.device
            ? { client: phase.device.client, deviceToken: phase.device.session.deviceToken }
            : undefined
        }
        onDone={async (newClient) => {
          const session = await loadSession();
          setPhase({ name: "app", client: newClient, profileName: session?.profile?.name ?? "" });
        }}
      />
    );
  }

  return (
    <Shell
      client={phase.client}
      player={player as Player}
      profileName={phase.profileName}
      managed={phase.managed ?? false}
      onSignOut={() => setPhase({ name: "signin", initialUrl: phase.client.baseUrl })}
    />
  );
}
