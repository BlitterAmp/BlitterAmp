import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Clipboard, FolderOpen, Pause, Play, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DiagnosticLevel, DiagnosticRecord, DiagnosticSnapshot, DiagnosticSource } from "../diagnostics";

const LIMIT = 5_000;
const levels: DiagnosticLevel[] = ["debug", "info", "warn", "error"];
const sources: DiagnosticSource[] = ["desktop", "webview", "server-stdout", "server-stderr", "server-lifecycle"];
const levelColor: Record<DiagnosticLevel, string> = { debug: "text-base-content/50", info: "text-info", warn: "text-warning", error: "text-error" };

export function LogsModal({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<DiagnosticRecord[]>([]);
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [persistence, setPersistence] = useState("");
  const epochRef = useRef(0);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);

  const merge = (old: DiagnosticRecord[], incoming: DiagnosticRecord[]) => [...new Map([...old, ...incoming].map((r) => [r.sequence, r])).values()].sort((a, b) => a.sequence - b.sequence).slice(-LIMIT);
  const load = async () => {
    const request = ++requestRef.current;
    try { const snapshot = await invoke<DiagnosticSnapshot>("diagnostics_snapshot", { limit: LIMIT }); if (!mountedRef.current || request !== requestRef.current) return; if (snapshot.epoch >= epochRef.current) { if (epochRef.current !== 0 && snapshot.epoch > epochRef.current) setRecords(snapshot.records); else setRecords((old) => merge(old, snapshot.records)); epochRef.current = snapshot.epoch; } setPersistence(snapshot.persistence.message); setError(""); }
    catch (err) { if (mountedRef.current && request === requestRef.current) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (mountedRef.current && request === requestRef.current) setLoading(false); }
  };

  useEffect(() => {
    mountedRef.current = true;
    const listeners = Promise.all([
      listen<DiagnosticRecord>("diagnostics:record", ({ payload }) => { if (!pausedRef.current) setRecords((old) => merge(old, [payload])); }),
      listen<{ epoch: number }>("diagnostics:cleared", ({ payload }) => { if (payload.epoch >= epochRef.current) { epochRef.current = payload.epoch; setRecords([]); } }),
    ]).then((unlisteners) => { if (mountedRef.current) void load(); else unlisteners.forEach((fn) => fn()); return unlisteners; });
    return () => { mountedRef.current = false; requestRef.current++; void listeners.then((fns) => fns.forEach((fn) => fn())); };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);

  const visible = records.filter((record) =>
    (level === "all" || record.level === level) &&
    (source === "all" || record.source === source) &&
    (!query.trim() || record.message.toLowerCase().includes(query.trim().toLowerCase())),
  );

  useEffect(() => {
    if (following && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [visible.length, following]);

  const text = visible.map((r) => `${r.timestamp} ${r.level.toUpperCase()} [${r.source}] ${r.message}`).join("\n");

  return <dialog className="modal modal-open" onClose={onClose}>
    <div className="modal-box flex h-[85vh] max-w-6xl flex-col p-0">
      <header className="flex items-center gap-3 border-b border-base-300 px-5 py-3">
        <h2 className="mr-auto text-lg font-semibold">Combined Logs</h2>
        <button className="btn btn-ghost btn-sm btn-square" title="Close" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-base-300 p-3">
        <select aria-label="Source" className="select select-sm select-bordered" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All sources</option>{sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Level" className="select select-sm select-bordered" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">All levels</option>{levels.map((l) => <option key={l}>{l}</option>)}
        </select>
        <input aria-label="Search logs" className="input input-sm input-bordered min-w-48 flex-1" placeholder="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn btn-sm" onClick={() => { const next = !paused; setPaused(next); pausedRef.current = next; if (!next) void load(); }}>
          {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn btn-sm" onClick={() => setConfirmCopy(true)}><Clipboard size={14} /> Copy visible</button>
        <button className="btn btn-sm" onClick={() => void invoke("diagnostics_open_folder").catch((e) => setError(String(e)))}><FolderOpen size={14} /> Open folder</button>
        <button className="btn btn-sm btn-error btn-outline" onClick={() => setConfirmClear(true)}><Trash2 size={14} /> Clear</button>
      </div>
      <p className="px-4 py-2 text-xs text-base-content/55">Diagnostics can still contain sensitive data. Review every line before sharing. Remote connections naturally have no local server output. {persistence}</p>
      {error && <div role="alert" className="alert alert-error mx-4 mb-2 py-2 text-sm">{error}</div>}
      <div ref={listRef} data-testid="log-list" className="min-h-0 flex-1 overflow-auto bg-neutral p-3 font-mono text-xs select-text"
        onScroll={(e) => { const el = e.currentTarget; setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24); }}>
        {loading ? <div>Loading logs…</div> : visible.length === 0 ? <div className="text-base-content/50">No matching log records.</div> : visible.map((record) =>
          <div key={record.sequence} className="grid grid-cols-[7.5rem_3.5rem_8.5rem_1fr] gap-2 whitespace-pre-wrap break-words py-0.5">
            <span className="text-base-content/45">{record.timestamp.slice(11, 23)}</span>
            <span className={levelColor[record.level]}>{record.level}</span>
            <span className="text-secondary">{record.source}</span>
            <span>{record.message}</span>
          </div>)}
      </div>
      <footer className="flex justify-between border-t border-base-300 px-4 py-2 text-xs text-base-content/50"><span>{visible.length} visible / {records.length} retained</span><span>{paused ? "Live tail paused" : following ? "Following live tail" : "Live tail active; scroll down to follow"}</span></footer>
    </div>
    <button type="button" className="modal-backdrop" aria-label="Close logs" onClick={onClose}>close</button>
    {confirmCopy && <div className="modal modal-open"><div className="modal-box max-w-sm"><h3 className="font-semibold">Copy visible diagnostics?</h3><p className="py-3 text-sm">Clipboard contents may be readable by other applications. Review the diagnostics before sharing them.</p><div className="modal-action"><button className="btn" onClick={() => setConfirmCopy(false)}>Cancel</button><button className="btn btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(text); setConfirmCopy(false); } catch (e) { setError(`Could not copy diagnostics: ${String(e)}`); } }}>Copy diagnostics</button></div></div></div>}
    {confirmClear && <div className="modal modal-open"><div className="modal-box max-w-sm"><h3 className="font-semibold">Clear diagnostic logs?</h3><p className="py-3 text-sm">This removes the in-app history and encrypted BlitterAmp diagnostic files.</p><div className="modal-action"><button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button><button className="btn btn-error" onClick={async () => { try { await invoke("diagnostics_clear"); setConfirmClear(false); } catch (e) { setError(String(e)); } }}>Clear logs</button></div></div></div>}
  </dialog>;
}
