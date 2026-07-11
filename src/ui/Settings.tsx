import { open } from "@tauri-apps/plugin-dialog";
import { audioDir, join } from "@tauri-apps/api/path";
import { X } from "lucide-react";
import { useState } from "react";
import { adoptRemote, type Connection, useLocal } from "../state/connection";
import type { SavedSession } from "../state/session";
import { Appearance } from "./settings/Appearance";
import { ConnectRemote } from "./settings/ConnectRemote";
import { Devices } from "./settings/Devices";
import { Integrations } from "./settings/Integrations";
import { Library } from "./settings/Library";
import { Profiles } from "./settings/Profiles";

type Section = "connection" | "library" | "profiles" | "devices" | "integrations" | "appearance";

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

  // Appearance is a UI preference, available regardless of connection; the
  // management panes only make sense for the local engine we administer.
  const nav: [Section, string][] = local
    ? [
        ["connection", "Connection"],
        ["library", "Library"],
        ["profiles", "Profiles"],
        ["devices", "Devices"],
        ["integrations", "Integrations"],
        ["appearance", "Appearance"],
      ]
    : [
        ["connection", "Connection"],
        ["appearance", "Appearance"],
      ];

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box flex h-[80vh] max-w-3xl flex-col p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <ul className="menu w-44 shrink-0 gap-0.5 border-r border-base-300 p-2">
            {nav.map(([id, label]) => (
              <li key={id}>
                <button type="button" className={section === id ? "menu-active" : ""} onClick={() => setSection(id)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "connection" && <ConnectionPane connection={connection} onConnectionChange={onConnectionChange} />}
            {section === "library" && admin && <Library admin={admin} baseUrl={connection.client.baseUrl} />}
            {section === "profiles" && admin && <Profiles admin={admin} />}
            {section === "devices" && admin && <Devices admin={admin} />}
            {section === "integrations" && admin && <Integrations admin={admin} />}
            {section === "appearance" && <Appearance />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionPane({
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
      <div>
        <h3 className="mb-4 text-xl font-semibold">Connect to a remote server</h3>
        <ConnectRemote onConnected={adopt} onCancel={() => setConnecting(false)} />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Connection</h3>
      {connection.kind === "local" ? (
        <div className="space-y-4">
          <div className="rounded-box bg-base-200 p-4">
            <div className="font-medium">This computer's library</div>
            <div className="text-sm opacity-70">BlitterAmp runs its own music server — no setup, nothing to manage elsewhere.</div>
          </div>
          <div className="flex items-center justify-between rounded-box bg-base-200 p-4">
            <div>
              <div className="font-medium">Use a remote BlitterServer</div>
              <div className="text-sm opacity-70">Play from a server you run on your network or elsewhere.</div>
            </div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setConnecting(true)}>
              Connect…
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-box bg-base-200 p-4">
            <div className="font-medium">Connected to a remote server</div>
            <div className="text-sm opacity-70">{connection.remoteUrl} — manage it in its own web admin.</div>
          </div>
          <div className="flex items-center justify-between rounded-box bg-base-200 p-4">
            <div>
              <div className="font-medium">Use this computer's library</div>
              <div className="text-sm opacity-70">Disconnect and play from the built-in local server.</div>
            </div>
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={busy} onClick={() => void goLocal()}>
              {busy ? "Switching…" : "Use local"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared native folder picker. */
export async function pickFolder(): Promise<string | null> {
  let defaultPath: string | undefined;
  try {
    defaultPath = await join(await audioDir(), "BlitterAmp");
  } catch {
    /* fall back to the dialog default */
  }
  const path = await open({ directory: true, multiple: false, title: "Choose your music folder", defaultPath });
  return typeof path === "string" ? path : null;
}
