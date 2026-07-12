// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const check = vi.fn();
const relaunch = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({ check: () => check() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => relaunch() }));

import { UpdatePrompt } from "./UpdatePrompt";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UpdatePrompt", () => {
  it("shows a prompt and installs + relaunches when an update is available", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    check.mockResolvedValue({ available: true, version: "1.2.3", downloadAndInstall });
    render(<UpdatePrompt />);
    await waitFor(() => expect(screen.getByText("Update available")).toBeTruthy());
    expect(screen.getByText(/1\.2\.3/)).toBeTruthy();

    fireEvent.click(screen.getByText("Install & Restart"));
    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalled());
    await waitFor(() => expect(relaunch).toHaveBeenCalled());
  });

  it("renders nothing when no update is available", async () => {
    check.mockResolvedValue({ available: false });
    const { container } = render(<UpdatePrompt />);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("stays silent when the updater is unavailable (dev / not packaged)", async () => {
    check.mockRejectedValue(new Error("not packaged"));
    const { container } = render(<UpdatePrompt />);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
