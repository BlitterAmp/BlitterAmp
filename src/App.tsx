import { useEffect, useMemo, useState } from "react";
import { Client } from "./api/client";
import { Player } from "./audio/player";
import { loadSession, restore } from "./state/session";
import { Shell } from "./ui/Shell";
import { SignIn } from "./ui/SignIn";

type Phase =
  | { name: "splash" }
  | { name: "signin" }
  | { name: "app"; client: Client; profileName: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "splash" });

  useEffect(() => {
    void (async () => {
      const restored = await restore();
      if (restored) {
        setPhase({
          name: "app",
          client: restored.client,
          profileName: restored.session.profile?.name ?? "",
        });
      } else {
        setPhase({ name: "signin" });
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
      onSignOut={() => setPhase({ name: "signin" })}
    />
  );
}
