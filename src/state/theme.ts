// Theme management: pick any built-in DaisyUI theme or a user-defined custom
// one. A DaisyUI theme is just CSS variables under a [data-theme] selector, so
// custom themes are injected as a <style> at runtime — no rebuild needed.
// Preferences live in localStorage (synchronous, so we can apply before the
// first paint and avoid a flash).

/** Our brand theme (defined in app.css) plus every DaisyUI 5 built-in. */
export const BUILTIN_THEMES = [
  "blitteramp",
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk",
] as const;

/** The DaisyUI color roles a custom theme sets. */
export const THEME_COLORS = [
  ["base-100", "Surface", "#16181f"],
  ["base-200", "Background", "#0d0e12"],
  ["base-300", "Raised", "#21242d"],
  ["base-content", "Text", "#e7e9ee"],
  ["primary", "Primary", "#54d2a0"],
  ["secondary", "Secondary", "#7c5cff"],
  ["accent", "Accent", "#7c5cff"],
  ["neutral", "Neutral", "#21242d"],
  ["info", "Info", "#54d2a0"],
  ["success", "Success", "#54d2a0"],
  ["warning", "Warning", "#febc2e"],
  ["error", "Error", "#ff5f57"],
] as const;

export type ColorKey = (typeof THEME_COLORS)[number][0];

export interface CustomTheme {
  name: string;
  dark: boolean;
  colors: Record<ColorKey, string>;
}

const ACTIVE_KEY = "blitteramp.theme";
const CUSTOM_KEY = "blitteramp.customThemes";
const STYLE_ID = "blitteramp-custom-themes";

export const DEFAULT_THEME = "blitteramp";

export function getActiveTheme(): string {
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_THEME;
}

export function setActiveTheme(name: string): void {
  localStorage.setItem(ACTIVE_KEY, name);
  document.documentElement.dataset.theme = name;
}

export function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as CustomTheme[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: CustomTheme[]): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(themes));
  injectCustomThemes(themes);
}

/** Rebuilds the injected <style> holding every custom theme's variables. */
export function injectCustomThemes(themes: CustomTheme[]): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = themes.map(themeCss).join("\n");
}

function themeCss(t: CustomTheme): string {
  const vars = THEME_COLORS.map(([key]) => {
    const value = t.colors[key];
    const content = key === "base-content" ? "" : `\n  --color-${key}-content: ${contrast(value)};`;
    return `  --color-${key}: ${value};${content}`;
  }).join("\n");
  return `[data-theme="${cssEscape(t.name)}"] {\n  color-scheme: ${t.dark ? "dark" : "light"};\n${vars}\n}`;
}

/** Picks black or white text for legibility on a given background color. */
function contrast(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#0d0e12" : "#ffffff";
}

function cssEscape(name: string): string {
  return name.replace(/["\\]/g, "");
}

/** Called once before React renders: apply custom themes + the active choice. */
export function initThemes(): void {
  injectCustomThemes(loadCustomThemes());
  document.documentElement.dataset.theme = getActiveTheme();
}

export function defaultCustomColors(): Record<ColorKey, string> {
  return Object.fromEntries(THEME_COLORS.map(([key, , def]) => [key, def])) as Record<ColorKey, string>;
}
