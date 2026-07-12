// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "../../api/client";
import { LastfmAccount } from "./LastfmAccount";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
import { openUrl } from "@tauri-apps/plugin-opener";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function clientWith(statuses: unknown[]) {
  const client = new Client("http://server", "token");
  const get = vi.spyOn(client, "get").mockImplementation(async () => {
    const next = statuses.shift();
    if (next instanceof Error) throw next;
    return next as never;
  });
  const post = vi.spyOn(client, "post").mockResolvedValue({ url: "https://www.last.fm/api/auth/?token=ok" } as never);
  const del = vi.spyOn(client, "del").mockResolvedValue(null as never);
  return { client, get, post, del };
}

describe("LastfmAccount", () => {
  it("explains when server credentials are unavailable", async () => {
    const { client } = clientWith([{ available: false, connected: false }]);
    render(<LastfmAccount client={client} />);
    expect(await screen.findByText(/no last.fm API credentials/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("opens the authorization URL for a disconnected account", async () => {
    const { client, post } = clientWith([{ available: true, connected: false }]);
    render(<LastfmAccount client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/v1/me/lastfm/connect"));
    expect(openUrl).toHaveBeenCalledWith("https://www.last.fm/api/auth/?token=ok");
  });

  it("polls until authorization completes and also supports explicit refresh", async () => {
    vi.useFakeTimers();
    const { client, get } = clientWith([
      { available: true, connected: false },
      { available: true, connected: true, username: "listener" },
      { available: true, connected: true, username: "listener" },
    ]);
    render(<LastfmAccount client={client} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/waiting for authorization/i)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByText(/listener/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await act(async () => { await Promise.resolve(); });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("shows the connected username and disconnects", async () => {
    const { client, del } = clientWith([{ available: true, connected: true, username: "listener" }]);
    render(<LastfmAccount client={client} />);
    expect(await screen.findByText(/listener/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/v1/me/lastfm"));
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
  });

  it("ignores an old disconnect after the client is replaced", async () => {
    let rejectDisconnect!: (error: unknown) => void;
    const old = clientWith([{ available: true, connected: true, username: "old-profile" }]);
    old.del.mockReturnValue(new Promise((_resolve, reject) => { rejectDisconnect = reject; }) as never);
    const current = clientWith([{ available: true, connected: true, username: "new-profile" }]);
    const view = render(<LastfmAccount client={old.client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    view.rerender(<LastfmAccount client={current.client} />);
    expect(await screen.findByText(/new-profile/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Disconnect" }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => rejectDisconnect(new Error("old server failed")));
    expect(screen.queryByText(/old server failed/i)).toBeNull();
    expect(screen.getByText(/new-profile/)).toBeTruthy();
  });

  it("keeps a successful disconnect from being overwritten by an earlier refresh", async () => {
    let resolveRefresh!: (value: unknown) => void;
    const account = clientWith([{ available: true, connected: true, username: "listener" }]);
    render(<LastfmAccount client={account.client} />);
    expect(await screen.findByText(/listener/)).toBeTruthy();
    account.get.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }) as never);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(account.del).toHaveBeenCalled());
    await act(async () => resolveRefresh({ available: true, connected: true, username: "listener" }));
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.queryByText(/Connected as/)).toBeNull();
  });

  it("shows an actionable status failure", async () => {
    const { client } = clientWith([new Error("offline")]);
    render(<LastfmAccount client={client} />);
    expect(await screen.findByText(/check the server connection.*offline/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  it.each([
    ["malformed", "not a URL"],
    ["custom scheme", "lastfm://www.last.fm/api/auth/"],
    ["plain HTTP", "http://www.last.fm/api/auth/"],
    ["unexpected host", "https://last.fm/api/auth/"],
    ["confusable subdomain", "https://www.last.fm.evil.example/api/auth/"],
    ["unexpected path", "https://www.last.fm/login"],
    ["embedded credentials", "https://user:pass@www.last.fm/api/auth/"],
  ])("rejects a %s authorization URL", async (_kind, url) => {
    const { client, post } = clientWith([{ available: true, connected: false }]);
    post.mockResolvedValue({ url } as never);
    render(<LastfmAccount client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText(/refused.*authorization URL/i)).toBeTruthy();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("ignores an out-of-order status response from a replaced client", async () => {
    let resolveOld!: (value: unknown) => void;
    const old = clientWith([]);
    old.get.mockReturnValue(new Promise((resolve) => { resolveOld = resolve; }) as never);
    const current = clientWith([{ available: true, connected: true, username: "new-profile" }]);
    const view = render(<LastfmAccount client={old.client} />);
    view.rerender(<LastfmAccount client={current.client} />);
    expect(await screen.findByText(/new-profile/)).toBeTruthy();
    await act(async () => resolveOld({ available: true, connected: true, username: "old-profile" }));
    expect(screen.queryByText(/old-profile/)).toBeNull();
    expect(screen.getByText(/new-profile/)).toBeTruthy();
  });

  it("does not poll while hidden and polls promptly when visible", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const { client, get } = clientWith([
      { available: true, connected: false },
      { available: true, connected: true, username: "visible-listener" },
    ]);
    render(<LastfmAccount client={client} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(get).toHaveBeenCalledTimes(1);
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/visible-listener/)).toBeTruthy();
  });

  it("stops polling at the attempt cap", async () => {
    vi.useFakeTimers();
    const disconnected = { available: true, connected: false };
    const { client, get } = clientWith(Array.from({ length: 40 }, () => disconnected));
    render(<LastfmAccount client={client} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(get).toHaveBeenCalledTimes(31);
    expect(screen.queryByText(/waiting for authorization/i)).toBeNull();
    expect(screen.getByText(/authorization was not observed.*Refresh/i)).toBeTruthy();
  });

  it("enforces the wall-clock deadline while hidden", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const { client, get } = clientWith([{ available: true, connected: false }]);
    render(<LastfmAccount client={client} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_001); });
    visibility = "visible";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/waiting for authorization/i)).toBeNull();
    expect(screen.getByText(/authorization was not observed.*Refresh/i)).toBeTruthy();
  });

  it("cleans up polling and ignores in-flight completion after unmount", async () => {
    vi.useFakeTimers();
    let resolvePoll!: (value: unknown) => void;
    const { client, get } = clientWith([{ available: true, connected: false }]);
    render(<LastfmAccount client={client} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await act(async () => { await Promise.resolve(); });
    get.mockReturnValueOnce(new Promise((resolve) => { resolvePoll = resolve; }) as never);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    cleanup();
    await act(async () => resolvePoll({ available: true, connected: true, username: "late" }));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
