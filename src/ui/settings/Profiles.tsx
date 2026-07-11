import { useEffect, useState } from "react";
import type { AdminClient } from "../../admin/adminClient";
import type { Profile } from "../../api/client";

export function Profiles({ admin }: { admin: AdminClient }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setProfiles((await admin.get<Profile[]>("/admin/api/profiles")) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await admin.post("/admin/api/profiles", { name, pin: pin || undefined });
      setName("");
      setPin("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the profile.");
    }
  }

  async function rename(p: Profile) {
    const next = window.prompt("New name", p.name);
    if (!next || next === p.name) return;
    try {
      await admin.patch(`/admin/api/profiles/${p.profileId}`, { name: next });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setProfilePin(p: Profile) {
    const next = window.prompt(`New 4–8 digit PIN for ${p.name} (empty to clear)`);
    if (next === null) return;
    try {
      await admin.patch(`/admin/api/profiles/${p.profileId}`, { pin: next === "" ? null : next });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(p: Profile) {
    if (!window.confirm(`Delete ${p.name}? Their playlists, loves, and history go with them.`)) return;
    try {
      await admin.del(`/admin/api/profiles/${p.profileId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-head">Profiles</div>
      {error && <div className="modal-error">{error}</div>}
      <div className="settings-section">
        {profiles.map((p) => (
          <div className="settings-row" key={p.profileId}>
            <div className="settings-row-text">
              <div className="settings-row-label">{p.name}</div>
              <div className="settings-row-desc">{p.hasPin ? "PIN set" : "No PIN"}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="settings-btn" onClick={() => void rename(p)}>
                Rename
              </button>
              <button type="button" className="settings-btn" onClick={() => void setProfilePin(p)}>
                PIN
              </button>
              <button type="button" className="settings-btn danger" onClick={() => void remove(p)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && <div className="settings-row-desc" style={{ padding: "14px 0" }}>No profiles yet.</div>}
      </div>
      <form className="settings-section" onSubmit={add}>
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Add a profile</div>
          </div>
        </div>
        <div className="settings-row" style={{ gap: 8 }}>
          <input className="settings-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="settings-input"
            placeholder="PIN (optional)"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <button type="submit" className="settings-btn modal-create" disabled={!name}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
