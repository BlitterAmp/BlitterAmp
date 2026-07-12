// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { openUrl } from "@tauri-apps/plugin-opener";
import { AboutModal } from "./AboutModal";

describe("AboutModal", () => {
  it("shows the version and loads the acknowledgements manifest", async () => {
    render(<AboutModal onClose={() => {}} />);
    expect(screen.getByText(/Version/)).toBeTruthy();
    // The manifest is dynamically imported, so the count appears asynchronously.
    await waitFor(() => expect(screen.getByText(/open-source projects/)).toBeTruthy());
  });

  it("filters the list and shows an empty state for no matches", async () => {
    render(<AboutModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/open-source projects/)).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Filter…"), { target: { value: "zzznomatchzzz" } });
    await waitFor(() => expect(screen.getByText(/No matches/)).toBeTruthy());
  });

  it("opens external links through the opener plugin, not the webview", async () => {
    render(<AboutModal onClose={() => {}} />);
    fireEvent.click(screen.getByText("MIT License"));
    expect(openUrl).toHaveBeenCalledWith("https://opensource.org/license/mit");
  });

  it("plays the logo sound once until playback ends", async () => {
    const play = vi.fn(() => Promise.resolve());
    let onEnded = () => {};
    vi.stubGlobal(
      "Audio",
      class {
        play = play;
        addEventListener(event: string, listener: () => void) {
          if (event === "ended") onEnded = listener;
        }
      },
    );

    render(<AboutModal onClose={() => {}} />);
    const logo = screen.getByRole("button", { name: "Play BlitterAmp sound", hidden: true });
    fireEvent.click(logo);
    fireEvent.click(logo);
    expect(play).toHaveBeenCalledTimes(1);

    onEnded();
    fireEvent.click(logo);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("closes on the close button", () => {
    const onClose = vi.fn();
    render(<AboutModal onClose={onClose} />);
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
