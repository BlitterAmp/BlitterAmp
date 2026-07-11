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
    <div>
      <h3 className="mb-1 text-xl font-semibold">Devices</h3>
      <p className="mb-4 text-sm opacity-60">
        Devices paired to this computer's library. Pairing a phone needs remote access (a later feature) — for now
        this computer is the one device.
      </p>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <ul className="divide-y divide-base-300 overflow-hidden rounded-box bg-base-200">
        {devices.map((d) => (
          <li key={d.deviceId} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-sm opacity-60">
                <span className="badge badge-ghost badge-sm mr-1">{d.type}</span>
                paired {new Date(d.pairedAt).toLocaleDateString()}
                {d.lastSeenAt ? ` · last seen ${new Date(d.lastSeenAt).toLocaleString()}` : ""}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => void revoke(d)}>
              Revoke
            </button>
          </li>
        ))}
        {devices.length === 0 && <li className="p-3 text-sm opacity-60">No paired devices.</li>}
      </ul>
    </div>
  );
}
