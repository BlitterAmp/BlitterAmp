// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const minimize = vi.fn();
const toggleMaximize = vi.fn();
const close = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ minimize, toggleMaximize, close }),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { openUrl } from "@tauri-apps/plugin-opener";
import { LinuxAppMenu, LinuxWindowControls } from "./LinuxWindowChrome";

describe("LinuxWindowChrome", () => {
  it("routes application menu actions", () => {
    const onSettings = vi.fn();
    const onAbout = vi.fn();
    const onLogs = vi.fn();
    render(<LinuxAppMenu onSettings={onSettings} onAbout={onAbout} onLogs={onLogs} />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "About BlitterAmp" }));
    fireEvent.click(screen.getByRole("button", { name: "Logs" }));
    fireEvent.click(screen.getByRole("button", { name: "GitHub" }));

    expect(onSettings).toHaveBeenCalledOnce();
    expect(onAbout).toHaveBeenCalledOnce();
    expect(onLogs).toHaveBeenCalledOnce();
    expect(openUrl).toHaveBeenCalledWith("https://github.com/BlitterAmp/BlitterAmp");
  });

  it("provides app-owned window controls", () => {
    render(<LinuxWindowControls />);

    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize or restore" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(minimize).toHaveBeenCalledOnce();
    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
