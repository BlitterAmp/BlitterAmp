import { useEffect, useRef, useState } from "react";
import { ApiError, Client, type Profile } from "../../api/client";
import { DEFAULT_LOCAL_URL, type SavedSession } from "../../state/session";

// Deliberate connect-to-remote wizard, launched from Settings. Unlike the old
// launch gate there's no auto-probe — the user is explicitly reaching for a
// server they run elsewhere. On success it hands back a SavedSession for the
// connection layer to adopt.
type Step =
  | { name: "server" }
  | { name: "pairing"; client: Client; pairingId: string; code: string }
  | { name: "profiles"; client: Client; deviceToken: string; profiles: Profile[] }
  | { name: "pin"; client: Client; deviceToken: string; profiles: Profile[]; profile: Profile };

export function ConnectRemote({
  onConnected,
  onCancel,
}: {
  onConnected: (session: SavedSession) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "server" });
  const [serverUrl, setServerUrl] = useState(DEFAULT_LOCAL_URL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        setError(`That server needs first-run setup — open ${url}/admin/ first.`);
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
      onConnected({
        serverUrl: client.baseUrl,
        deviceToken,
        profileToken: minted.token,
        profile: minted.profile,
        managed: false,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        if (pin === undefined) setStep({ name: "pin", client, deviceToken, profiles, profile });
        else setError("Wrong PIN.");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not switch to that profile.");
    }
  }

  return (
    <div className="settings-section">
      {step.name === "server" && (
        <form onSubmit={connect}>
          <p className="settings-row-desc">
            Connect to a BlitterServer you run elsewhere. You'll approve this device in that server's web admin.
          </p>
          <input
            className="settings-input"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://music.example.net"
            spellCheck={false}
            autoFocus
          />
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="settings-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="settings-btn modal-create" disabled={busy || !serverUrl}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      )}

      {step.name === "pairing" && (
        <PairingWait
          step={step}
          error={error}
          onError={setError}
          onCancel={() => setStep({ name: "server" })}
          onPaired={async (deviceToken) => {
            const deviceClient = step.client.withToken(deviceToken);
            const profiles = await deviceClient.listProfiles();
            setStep({ name: "profiles", client: deviceClient, deviceToken, profiles });
          }}
        />
      )}

      {step.name === "profiles" && (
        <div>
          <p className="settings-row-desc">Who's listening?</p>
          {step.profiles.map((p) => (
            <button
              key={p.profileId}
              type="button"
              className="settings-btn"
              style={{ display: "block", width: "100%", marginBottom: 8 }}
              onClick={() => void pickProfile(step.client, step.deviceToken, step.profiles, p)}
            >
              {p.name}
              {p.hasPin ? " 🔒" : ""}
            </button>
          ))}
          {step.profiles.length === 0 && (
            <p className="settings-row-desc">
              No profiles on that server yet — create one in its web admin at {step.client.baseUrl}/admin/
            </p>
          )}
          {error && <div className="modal-error">{error}</div>}
        </div>
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
          onError(state.status === "denied" ? "The request was denied." : "The code expired — try again.");
          onCancel();
        }
      } catch {
        /* transient; keep polling */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [step, onPaired, onError, onCancel]);

  return (
    <div>
      <p className="settings-row-desc">Approve this device in the server's web admin → Pairing, matching this code:</p>
      <div className="signin-code">{step.code}</div>
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="settings-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
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
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pin);
      }}
    >
      <p className="settings-row-desc">PIN for {profile.name}</p>
      <input
        className="settings-input"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        autoFocus
      />
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="settings-btn" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="settings-btn modal-create" disabled={pin.length < 4}>
          Unlock
        </button>
      </div>
    </form>
  );
}

function deviceName(): string {
  return `BlitterAmp on ${navigator.platform || "Desktop"}`;
}
