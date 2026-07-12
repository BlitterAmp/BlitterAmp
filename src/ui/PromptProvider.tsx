// A small in-app text prompt. Tauri's webview doesn't implement window.prompt
// (it returns null), which silently broke "New playlist" / "Rename". usePrompt()
// returns a promise-based prompt backed by a DaisyUI modal.
import { createContext, useCallback, useContext, useRef, useState } from "react";

interface PromptOpts {
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
}

type PromptFn = (opts: PromptOpts) => Promise<string | null>;

const PromptCtx = createContext<PromptFn | null>(null);

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<PromptOpts | null>(null);
  const [value, setValue] = useState("");
  const resolveRef = useRef<((v: string | null) => void) | null>(null);

  const prompt = useCallback<PromptFn>((o) => {
    setOpts(o);
    setValue(o.initial ?? "");
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = (v: string | null) => {
    setOpts(null);
    resolveRef.current?.(v);
    resolveRef.current = null;
  };

  return (
    <PromptCtx.Provider value={prompt}>
      {children}
      {opts && (
        <dialog className="modal modal-open">
          <form
            className="modal-box"
            onSubmit={(e) => {
              e.preventDefault();
              finish(value.trim() ? value.trim() : null);
            }}
          >
            <h3 className="mb-3 text-lg font-semibold">{opts.title}</h3>
            {/* biome-ignore lint/a11y/noAutofocus: a prompt should focus its input */}
            <input
              autoFocus
              type="text"
              className="input input-bordered w-full"
              placeholder={opts.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") finish(null);
              }}
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => finish(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
                {opts.confirmLabel ?? "OK"}
              </button>
            </div>
          </form>
          <button type="button" className="modal-backdrop" onClick={() => finish(null)} aria-label="Cancel">
            close
          </button>
        </dialog>
      )}
    </PromptCtx.Provider>
  );
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptCtx);
  if (!ctx) throw new Error("usePrompt must be used within PromptProvider");
  return ctx;
}
