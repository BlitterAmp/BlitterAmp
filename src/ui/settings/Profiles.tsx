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

  async function patch(p: Profile, prompt: string, key: "name" | "pin", clearable = false) {
    const next = window.prompt(prompt, key === "name" ? p.name : "");
    if (next === null) return;
    try {
      await admin.patch(`/admin/api/profiles/${p.profileId}`, { [key]: clearable && next === "" ? null : next });
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
    <div>
      <h3 className="mb-4 text-xl font-semibold">Profiles</h3>
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <ul className="mb-4 divide-y divide-base-300 overflow-hidden rounded-box bg-base-200">
        {profiles.map((p) => (
          <li key={p.profileId} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm opacity-60">{p.hasPin ? "PIN set" : "No PIN"}</div>
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => void patch(p, "New name", "name")}>
                Rename
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => void patch(p, `New 4–8 digit PIN for ${p.name} (empty to clear)`, "pin", true)}
              >
                PIN
              </button>
              <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => void remove(p)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {profiles.length === 0 && <li className="p-3 text-sm opacity-60">No profiles yet.</li>}
      </ul>

      <form className="flex items-end gap-2" onSubmit={add}>
        <input className="input input-sm input-bordered flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input input-sm input-bordered w-32" placeholder="PIN (optional)" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-primary" disabled={!name}>
          Add
        </button>
      </form>
    </div>
  );
}
