import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";

interface Device {
  deviceId: string;
  name: string;
  type: string;
  pairedAt: string;
  lastSeenAt?: string | null;
}

export function Devices({ admin }: { admin: AdminClient }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setDevices((await admin.get<Device[]>("/admin/api/devices")) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revoke(d: Device) {
    if (!window.confirm(`Revoke ${d.name}? Its access stops immediately.`)) return;
    try {
      await admin.del(`/admin/api/devices/${d.deviceId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">Devices</div>
      <div className="settings-subhead">
        Devices paired to this computer's library. Pairing a phone needs remote access (a later feature) — for now
        this computer is the one device.
      </div>
      {error && <div className="modal-error">{error}</div>}
      <div className="settings-section">
        {devices.map((d) => (
          <div className="settings-row" key={d.deviceId}>
            <div className="settings-row-text">
              <div className="settings-row-label">{d.name}</div>
              <div className="settings-row-desc">
                {d.type} · paired {new Date(d.pairedAt).toLocaleDateString()}
                {d.lastSeenAt ? ` · last seen ${new Date(d.lastSeenAt).toLocaleString()}` : ""}
              </div>
            </div>
            <button type="button" className="settings-btn danger" onClick={() => void revoke(d)}>
              Revoke
            </button>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="settings-row-desc" style={{ padding: "14px 0" }}>No paired devices.</div>
        )}
      </div>
    </div>
  );
}
