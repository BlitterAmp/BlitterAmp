import { open } from "@tauri-apps/plugin-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { Connection } from "../state/connection";
import { adoptRemote, useLocal } from "../state/connection";
import type { SavedSession } from "../state/session";
import { ConnectRemote } from "./settings/ConnectRemote";
import { Devices } from "./settings/Devices";
import { Integrations } from "./settings/Integrations";
import { Library } from "./settings/Library";
import { Profiles } from "./settings/Profiles";

type Section = "connection" | "library" | "profiles" | "devices" | "integrations";

export function Settings({
  connection,
  onConnectionChange,
  onClose,
}: {
  connection: Connection;
  onConnectionChange: (c: Connection) => void;
  onClose: () => void;
}) {
  const local = connection.kind === "local";
  const [section, setSection] = useState<Section>("connection");
  const admin = connection.admin;

  const nav: [Section, string][] = local
    ? [
        ["connection", "Connection"],
        ["library", "Library"],
        ["profiles", "Profiles"],
        ["devices", "Devices"],
        ["integrations", "Integrations"],
      ]
    : [["connection", "Connection"]];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-head">
          <div className="shortcuts-modal-title">Settings</div>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-layout">
            <nav className="settings-nav">
              {nav.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={section === id ? "active" : ""}
                  onClick={() => setSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="settings-pane">
              {section === "connection" && (
                <Connection connection={connection} onConnectionChange={onConnectionChange} />
              )}
              {section === "library" && admin && <Library admin={admin} baseUrl={connection.client.baseUrl} />}
              {section === "profiles" && admin && <Profiles admin={admin} />}
              {section === "devices" && admin && <Devices admin={admin} />}
              {section === "integrations" && admin && <Integrations admin={admin} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Connection({
  connection,
  onConnectionChange,
}: {
  connection: Connection;
  onConnectionChange: (c: Connection) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function adopt(session: SavedSession) {
    setConnecting(false);
    onConnectionChange(await adoptRemote(session));
  }

  async function goLocal() {
    setBusy(true);
    try {
      onConnectionChange(await useLocal());
    } finally {
      setBusy(false);
    }
  }

  if (connecting) {
    return (
      <div className="settings-page">
        <div className="settings-head">Connect to a remote server</div>
        <ConnectRemote onConnected={adopt} onCancel={() => setConnecting(false)} />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-head">Connection</div>
      <div className="settings-section">
        {connection.kind === "local" ? (
          <>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label">This computer's library</div>
                <div className="settings-row-desc">
                  BlitterAmp runs its own music server — no setup, nothing to manage elsewhere.
                </div>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label">Use a remote BlitterServer</div>
                <div className="settings-row-desc">Play from a server you run on your network or elsewhere.</div>
              </div>
              <button type="button" className="settings-btn" onClick={() => setConnecting(true)}>
                Connect…
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label">Connected to a remote server</div>
                <div className="settings-row-desc">{connection.remoteUrl} — manage it in its own web admin.</div>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label">Use this computer's library</div>
                <div className="settings-row-desc">Disconnect and play from the built-in local server.</div>
              </div>
              <button type="button" className="settings-btn danger" disabled={busy} onClick={() => void goLocal()}>
                {busy ? "Switching…" : "Use local"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Re-export the folder picker so Library can reuse it without another import path.
export async function pickFolder(): Promise<string | null> {
  const path = await open({ directory: true, multiple: false, title: "Choose your music folder" });
  return typeof path === "string" ? path : null;
}
