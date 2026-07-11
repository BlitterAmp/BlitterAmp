// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_THEMES,
  defaultCustomColors,
  getActiveTheme,
  injectCustomThemes,
  loadCustomThemes,
  saveCustomThemes,
  setActiveTheme,
  THEME_COLORS,
} from "./theme";

describe("theme manager", () => {
  beforeEach(() => {
    // Node 22's experimental localStorage global shadows jsdom's; use a stub.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
    document.getElementById("blitteramp-custom-themes")?.remove();
    document.documentElement.removeAttribute("data-theme");
  });

  it("ships the brand theme plus DaisyUI built-ins", () => {
    expect(BUILTIN_THEMES[0]).toBe("blitteramp");
    expect(BUILTIN_THEMES).toContain("synthwave");
    expect(BUILTIN_THEMES).toContain("dracula");
  });

  it("defaults to blitteramp and persists the active choice", () => {
    expect(getActiveTheme()).toBe("blitteramp");
    setActiveTheme("dracula");
    expect(getActiveTheme()).toBe("dracula");
    expect(document.documentElement.dataset.theme).toBe("dracula");
  });

  it("round-trips custom themes and injects their CSS variables", () => {
    const colors = defaultCustomColors();
    expect(Object.keys(colors)).toHaveLength(THEME_COLORS.length);
    saveCustomThemes([{ name: "neon", dark: true, colors: { ...colors, primary: "#ff00ff" } }]);
    expect(loadCustomThemes()[0].name).toBe("neon");

    const style = document.getElementById("blitteramp-custom-themes");
    expect(style?.textContent).toContain('[data-theme="neon"]');
    expect(style?.textContent).toContain("--color-primary: #ff00ff");
    expect(style?.textContent).toContain("color-scheme: dark");
  });

  it("picks a legible content color per background luminance", () => {
    injectCustomThemes([
      { name: "lighttest", dark: false, colors: { ...defaultCustomColors(), primary: "#ffffff" } },
      { name: "darktest", dark: true, colors: { ...defaultCustomColors(), primary: "#000000" } },
    ]);
    const css = document.getElementById("blitteramp-custom-themes")?.textContent ?? "";
    // white primary -> dark text; black primary -> white text
    expect(css).toMatch(/--color-primary: #ffffff;\s*--color-primary-content: #0d0e12/);
    expect(css).toMatch(/--color-primary: #000000;\s*--color-primary-content: #ffffff/);
  });
});
