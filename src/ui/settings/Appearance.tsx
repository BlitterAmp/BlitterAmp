import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  BUILTIN_THEMES,
  type ColorKey,
  type CustomTheme,
  THEME_COLORS,
  defaultCustomColors,
  getActiveTheme,
  loadCustomThemes,
  saveCustomThemes,
  setActiveTheme,
} from "../../state/theme";

/** A small preview scoped to its own theme via data-theme. */
function ThemeSwatch({ name, active, onPick }: { name: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-theme={name}
      onClick={onPick}
      className={`flex items-center gap-2 rounded-box border-2 bg-base-100 p-2 text-left transition ${
        active ? "border-primary" : "border-base-300 hover:border-base-content/30"
      }`}
    >
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-base-content">{name}</span>
        <div className="flex gap-1">
          <span className="size-4 rounded bg-primary" />
          <span className="size-4 rounded bg-secondary" />
          <span className="size-4 rounded bg-accent" />
          <span className="size-4 rounded bg-neutral" />
        </div>
      </div>
      {active && <Check size={16} className="text-primary" />}
    </button>
  );
}

export function Appearance() {
  const [active, setActive] = useState(getActiveTheme());
  const [custom, setCustom] = useState<CustomTheme[]>(loadCustomThemes());
  const [editing, setEditing] = useState<CustomTheme | null>(null);

  function pick(name: string) {
    setActiveTheme(name);
    setActive(name);
  }

  function persist(list: CustomTheme[]) {
    saveCustomThemes(list);
    setCustom(list);
  }

  function saveEdited(theme: CustomTheme) {
    const list = [...custom.filter((t) => t.name !== theme.name), theme];
    persist(list);
    setEditing(null);
    pick(theme.name);
  }

  function remove(name: string) {
    persist(custom.filter((t) => t.name !== name));
    if (active === name) pick("blitteramp");
  }

  if (editing) {
    return <ThemeEditor initial={editing} existing={custom} onSave={saveEdited} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold">Appearance</h3>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium opacity-80">Your themes</span>
          <button
            type="button"
            className="btn btn-xs btn-primary gap-1"
            onClick={() =>
              setEditing({ name: uniqueName(custom), dark: true, colors: defaultCustomColors() })
            }
          >
            <Plus size={13} /> New
          </button>
        </div>
        {custom.length === 0 ? (
          <p className="text-sm opacity-60">No custom themes yet. Create one to match your setup.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {custom.map((t) => (
              <div key={t.name} className="relative">
                <ThemeSwatch name={t.name} active={active === t.name} onPick={() => pick(t.name)} />
                <div className="absolute right-1 top-1 flex gap-0.5">
                  <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setEditing(t)} aria-label="Edit">
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs btn-square text-error" onClick={() => remove(t.name)} aria-label="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2 text-sm font-medium opacity-80">Built-in themes</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BUILTIN_THEMES.map((name) => (
          <ThemeSwatch key={name} name={name} active={active === name} onPick={() => pick(name)} />
        ))}
      </div>
    </div>
  );
}

function ThemeEditor({
  initial,
  existing,
  onSave,
  onCancel,
}: {
  initial: CustomTheme;
  existing: CustomTheme[];
  onSave: (t: CustomTheme) => void;
  onCancel: () => void;
}) {
  const [theme, setTheme] = useState<CustomTheme>(initial);
  const nameTaken =
    theme.name !== initial.name && existing.some((t) => t.name === theme.name);
  const valid = /^[a-zA-Z0-9 _-]{1,32}$/.test(theme.name) && !nameTaken;

  function setColor(key: ColorKey, value: string) {
    setTheme({ ...theme, colors: { ...theme.colors, [key]: value } });
  }

  return (
    // Preview live: the editor renders under the theme being edited via a
    // one-off injected style is overkill — instead just show the swatches
    // reading the picked values directly.
    <div>
      <h3 className="mb-4 text-xl font-semibold">Custom theme</h3>

      <label className="mb-4 block">
        <span className="text-sm opacity-70">Name</span>
        <input
          className={`input input-bordered mt-1 w-full ${nameTaken ? "input-error" : ""}`}
          value={theme.name}
          onChange={(e) => setTheme({ ...theme, name: e.target.value })}
        />
        {nameTaken && <span className="text-xs text-error">A theme with that name already exists.</span>}
      </label>

      <label className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={theme.dark}
          onChange={(e) => setTheme({ ...theme, dark: e.target.checked })}
        />
        <span className="text-sm">Dark theme (affects contrast defaults)</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {THEME_COLORS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="color"
              className="size-8 shrink-0 cursor-pointer rounded border border-base-300 bg-transparent"
              value={theme.colors[key]}
              onChange={(e) => setColor(key, e.target.value)}
            />
            <div className="min-w-0">
              <div className="truncate text-sm">{label}</div>
              <div className="font-mono text-xs opacity-50">{theme.colors[key]}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!valid} onClick={() => onSave(theme)}>
          Save theme
        </button>
      </div>
    </div>
  );
}

function uniqueName(existing: CustomTheme[]): string {
  let n = 1;
  let name = "my-theme";
  const names = new Set(existing.map((t) => t.name));
  while (names.has(name)) {
    n += 1;
    name = `my-theme-${n}`;
  }
  return name;
}
