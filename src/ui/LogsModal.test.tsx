// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const unlisten = vi.fn();
let live: ((event: { payload: RecordItem }) => void) | undefined;
let cleared: ((event: { payload: { epoch: number } }) => void) | undefined;
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn((name: string, callback: typeof live) => { if (name === "diagnostics:record") live = callback; else cleared = callback as typeof cleared; return Promise.resolve(unlisten); }) }));

interface RecordItem { sequence: number; timestampMs: number; timestamp: string; level: "debug" | "info" | "warn" | "error"; source: "desktop" | "webview" | "server-stdout" | "server-stderr" | "server-lifecycle"; message: string }
const row = (sequence: number, level: RecordItem["level"], source: RecordItem["source"], message: string): RecordItem => ({ sequence, timestampMs: sequence, timestamp: "2026-07-12T10:11:12.000Z", level, source, message });

beforeEach(() => {
  invoke.mockReset(); unlisten.mockReset(); live = undefined; cleared = undefined;
  invoke.mockImplementation((command: string) => command === "diagnostics_snapshot" ? Promise.resolve({ records: [
    row(1, "info", "desktop", "ready"), row(2, "error", "server-stderr", "failed safely"),
  ], epoch: 1, persistence: { enabled: true, message: "Encrypted history enabled." } }) : Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

import { LogsModal } from "./LogsModal";

describe("LogsModal", () => {
  it("loads a snapshot, receives live records, and unlistens", async () => {
    const view = render(<LogsModal onClose={() => {}} />);
    await screen.findByText("ready");
    live?.({ payload: row(3, "warn", "webview", "live") });
    expect(await screen.findByText("live")).toBeTruthy();
    cleared?.({ payload: { epoch: 2 } }); await waitFor(() => expect(screen.queryByText("ready")).toBeNull());
    view.unmount(); await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(2));
  });

  it("filters by source, level, and search", async () => {
    render(<LogsModal onClose={() => {}} />); await screen.findByText("ready");
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "server-stderr" } });
    expect(screen.queryByText("ready")).toBeNull();
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "error" } });
    fireEvent.change(screen.getByLabelText("Search logs"), { target: { value: "safely" } });
    expect(screen.getByText("failed safely")).toBeTruthy();
  });

  it("pauses live updates and refreshes on resume", async () => {
    render(<LogsModal onClose={() => {}} />); await screen.findByText("ready");
    fireEvent.click(screen.getByText("Pause")); live?.({ payload: row(3, "warn", "webview", "hidden live") });
    expect(screen.queryByText("hidden live")).toBeNull();
    fireEvent.click(screen.getByText("Resume")); await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  });

  it("copies visible rows, opens the folder, and confirms clear", async () => {
    render(<LogsModal onClose={() => {}} />); await screen.findByText("ready");
    fireEvent.click(screen.getByText("Copy visible")); expect(screen.getByText("Copy visible diagnostics?")).toBeTruthy();
    fireEvent.click(screen.getByText("Copy diagnostics")); await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("ready")));
    fireEvent.click(screen.getByText("Open folder")); expect(invoke).toHaveBeenCalledWith("diagnostics_open_folder");
    fireEvent.click(screen.getByText("Clear")); expect(screen.getByText("Clear diagnostic logs?")).toBeTruthy();
    fireEvent.click(screen.getByText("Clear logs")); await waitFor(() => expect(invoke).toHaveBeenCalledWith("diagnostics_clear"));
  });

  it("closes on Escape and renders malicious-looking text as plain text", async () => {
    invoke.mockImplementation((command: string) => command === "diagnostics_snapshot" ? Promise.resolve({ records: [row(1, "error", "webview", "<img src=x onerror=alert(1)>")], epoch: 1, persistence: { enabled: false, message: "Memory-only." } }) : Promise.resolve());
    const close = vi.fn(); render(<LogsModal onClose={close} />);
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy(); expect(document.querySelector("img")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).toHaveBeenCalled();
  });

  it("shows snapshot and command errors", async () => {
    invoke.mockRejectedValueOnce(new Error("snapshot unavailable"));
    render(<LogsModal onClose={() => {}} />); expect(await screen.findByText("snapshot unavailable")).toBeTruthy();
  });

  it("reports clipboard failures", async () => {
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error("denied"));
    render(<LogsModal onClose={() => {}} />); await screen.findByText("ready");
    fireEvent.click(screen.getByText("Copy visible")); fireEvent.click(screen.getByText("Copy diagnostics"));
    expect(await screen.findByText(/Could not copy diagnostics/)).toBeTruthy();
  });

  it("merges live records that arrive before the snapshot and ignores stale work after unmount", async () => {
    let resolveSnapshot!: (value: unknown) => void;
    invoke.mockImplementation((command: string) => command === "diagnostics_snapshot" ? new Promise((resolve) => { resolveSnapshot = resolve; }) : Promise.resolve());
    const view = render(<LogsModal onClose={() => {}} />);
    await waitFor(() => expect(live).toBeTruthy());
    live?.({ payload: row(3, "warn", "webview", "arrived first") });
    resolveSnapshot({ records: [row(1, "info", "desktop", "snapshot row")], epoch: 1, persistence: { enabled: true, message: "Encrypted." } });
    expect(await screen.findByText("arrived first")).toBeTruthy();
    expect(await screen.findByText("snapshot row")).toBeTruthy();
    view.unmount();
  });
});
