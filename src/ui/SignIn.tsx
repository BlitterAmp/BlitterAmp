import { useEffect, useRef, useState } from "react";
import { ApiError, Client, type Profile } from "../api/client";
import { DEFAULT_LOCAL_URL, saveSession } from "../state/session";

type Step =
  | { name: "server" }
  | { name: "pairing"; client: Client; pairingId: string; code: string }
  | { name: "profiles"; client: Client; deviceToken: string; profiles: Profile[] }
  | { name: "pin"; client: Client; deviceToken: string; profiles: Profile[]; profile: Profile };

export function SignIn({
  onDone,
  initialUrl,
  initialDevice,
}: {
  onDone: (client: Client) => void;
  initialUrl?: string;
  initialDevice?: { client: Client; deviceToken: string };
}) {
  const [step, setStep] = useState<Step>({ name: "server" });
  const [serverUrl, setServerUrl] = useState(initialUrl ?? DEFAULT_LOCAL_URL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(!initialDevice);
  const autoRan = useRef(false);

  // A restored device token skips pairing entirely: straight to profiles.
  useEffect(() => {
    if (!initialDevice || autoRan.current) return;
    autoRan.current = true;
    setProbing(false);
    void initialDevice.client
      .listProfiles()
      .then((profiles) =>
        setStep({ name: "profiles", client: initialDevice.client, deviceToken: initialDevice.deviceToken, profiles }),
      )
      .catch(() => setStep({ name: "server" }));
  }, [initialDevice]);

  // First-run auto-connect: probe the last-used (or local) server, and when
  // one answers, start pairing without waiting for a click.
  useEffect(() => {
    if (initialDevice || autoRan.current) return;
    autoRan.current = true;
    void (async () => {
      const url = (initialUrl ?? DEFAULT_LOCAL_URL).replace(/\/$/, "");
      try {
        const client = new Client(url);
        const ping = await client.ping();
        if (ping.name === "BlitterServer" && ping.setupComplete) {
          const pairing = await client.startPairing(deviceName());
          setStep({ name: "pairing", client, pairingId: pairing.pairingId, code: pairing.code });
        } else if (ping.name === "BlitterServer" && !ping.setupComplete) {
          setError(`Found a BlitterServer at ${url}, but it needs first-run setup — open ${url}/admin/ first.`);
        }
      } catch {
        // Nothing answering there — the form is already showing.
      } finally {
        setProbing(false);
      }
    })();
  }, [initialDevice, initialUrl]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const url = serverUrl.replace(/\/$/, "");
    const client = new Client(url);
    try {
      const ping = await client.ping();
      if (ping.name !== "BlitterServer") {
        setError("That answered, but it doesn't look like a BlitterServer.");
        return;
      }
      if (!ping.setupComplete) {
        setError(`Server needs first-run setup — open ${url}/admin/ first.`);
        return;
      }
      const pairing = await client.startPairing(deviceName());
      setStep({ name: "pairing", client, pairingId: pairing.pairingId, code: pairing.code });
    } catch (err) {
      setError(err instanceof Error ? `Could not reach the server: ${err.message}` : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function pickProfile(client: Client, deviceToken: string, profiles: Profile[], profile: Profile, pin?: string) {
    setError("");
    try {
      const minted = await client.createProfileToken(profile.profileId, pin);
      const profileClient = new Client(client.baseUrl, minted.token);
      await saveSession({
        serverUrl: client.baseUrl,
        deviceToken,
        profileToken: minted.token,
        profile: minted.profile,
      });
      onDone(profileClient);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        if (pin === undefined) {
          setStep({ name: "pin", client, deviceToken, profiles, profile });
        } else {
          setError("Wrong PIN.");
        }
        return;
      }
      setError(err instanceof Error ? err.message : "Could not switch to that profile.");
    }
  }

  return (
    <div className="signin-screen">
      <div className="signin-logo brand">
        Blitter<span>Amp</span>
      </div>

      {step.name === "server" && (
        <form onSubmit={connect} style={{ display: "contents" }}>
          <div className="signin-tagline">
            {probing ? "Looking for your BlitterServer…" : "Connect to your BlitterServer"}
          </div>
          <input
            className="signin-input"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://music.example.net"
            spellCheck={false}
            autoFocus
          />
          {error && <div className="signin-error">{error}</div>}
          <button className="signin-btn" type="submit" disabled={busy || !serverUrl}>
            <span className="server-mark" />
            {busy ? "Connecting…" : "Connect"}
          </button>
          <div className="signin-foot">Your music, your server. BlitterAmp talks only to BlitterServer.</div>
        </form>
      )}

      {step.name === "pairing" && (
        <PairingWait
          step={step}
          onError={setError}
          error={error}
          onCancel={() => setStep({ name: "server" })}
          onPaired={async (deviceToken) => {
            // Saved immediately: the server hands this token out exactly once.
            await saveSession({ serverUrl: step.client.baseUrl, deviceToken });
            const deviceClient = step.client.withToken(deviceToken);
            const profiles = await deviceClient.listProfiles();
            setStep({ name: "profiles", client: deviceClient, deviceToken, profiles });
          }}
        />
      )}

      {step.name === "profiles" && (
        <>
          <div className="signin-tagline compact">Who's listening?</div>
          <div className="signin-profiles">
            {step.profiles.map((p) => (
              <button
                key={p.profileId}
                type="button"
                className="signin-btn"
                onClick={() => void pickProfile(step.client, step.deviceToken, step.profiles, p)}
              >
                {p.name}
                {p.hasPin ? " 🔒" : ""}
              </button>
            ))}
            {step.profiles.length === 0 && (
              <div className="signin-hint">
                No profiles yet — create one in the web admin at {step.client.baseUrl}/admin/
              </div>
            )}
          </div>
          {error && <div className="signin-error">{error}</div>}
        </>
      )}

      {step.name === "pin" && (
        <PinPrompt
          profile={step.profile}
          error={error}
          onSubmit={(pin) => void pickProfile(step.client, step.deviceToken, step.profiles, step.profile, pin)}
          onBack={() => setStep({ name: "profiles", client: step.client, deviceToken: step.deviceToken, profiles: step.profiles })}
        />
      )}
    </div>
  );
}

function PairingWait({
  step,
  error,
  onPaired,
  onError,
  onCancel,
}: {
  step: { client: Client; pairingId: string; code: string };
  error: string;
  onPaired: (deviceToken: string) => Promise<void>;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const done = useRef(false);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (done.current) return;
      try {
        const state = await step.client.getPairing(step.pairingId);
        if (state.status === "approved" && state.token) {
          done.current = true;
          clearInterval(timer);
          await onPaired(state.token);
        } else if (state.status === "denied" || state.status === "expired") {
          done.current = true;
          clearInterval(timer);
          onError(state.status === "denied" ? "The request was denied in the web admin." : "The code expired — try again.");
          onCancel();
        }
      } catch {
        // transient poll failure; keep trying until expiry
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [step, onPaired, onError, onCancel]);

  return (
    <>
      <div className="signin-tagline compact">Approve this device</div>
      <div className="signin-code">{step.code}</div>
      <div className="signin-hint">
        Open the web admin at {step.client.baseUrl}/admin/ → Pairing, and approve the request showing this code.
      </div>
      <div className="signin-dots">
        <span />
        <span />
        <span />
      </div>
      {error && <div className="signin-error">{error}</div>}
      <button type="button" className="signin-cancel" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

function PinPrompt({
  profile,
  error,
  onSubmit,
  onBack,
}: {
  profile: Profile;
  error: string;
  onSubmit: (pin: string) => void;
  onBack: () => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <form
      style={{ display: "contents" }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pin);
      }}
    >
      <div className="signin-tagline compact">PIN for {profile.name}</div>
      <input
        className="signin-input"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        autoFocus
      />
      {error && <div className="signin-error">{error}</div>}
      <button className="signin-btn" type="submit" disabled={pin.length < 4}>
        Unlock
      </button>
      <button type="button" className="signin-cancel" onClick={onBack}>
        Back
      </button>
    </form>
  );
}

function deviceName(): string {
  const platform = navigator.platform || "Desktop";
  return `BlitterAmp on ${platform}`;
}
