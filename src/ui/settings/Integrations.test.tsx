// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminClient } from "../../admin/adminClient";
import { Integrations } from "./Integrations";

afterEach(cleanup);

function adminClient({ discogs = false, fanart = false, lastfm = false }: { discogs?: boolean; fanart?: boolean; lastfm?: boolean } = {}) {
  const get = vi.fn(async (path: string) => {
    if (path.endsWith("/lidarr")) return { configured: false };
    if (path.endsWith("/lastfm")) return { configured: lastfm, connectedProfiles: lastfm ? 2 : 0 };
    if (path.endsWith("/fanart")) return { configured: fanart };
    if (path.endsWith("/discogs")) return { configured: discogs };
    throw new Error(`unexpected GET ${path}`);
  });
  const put = vi.fn(async () => undefined);
  const del = vi.fn(async () => undefined);
  return { client: { get, put, del } as unknown as AdminClient, get, put, del };
}

describe("Integrations", () => {
  it("loads and saves the fanart.tv API key without retaining the secret", async () => {
    const { client, get, put } = adminClient();
    render(<Integrations admin={client} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/api/integrations/fanart"));
    const input = screen.getByPlaceholderText("fanart.tv API key");
    fireEvent.change(input, { target: { value: "secret-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save fanart.tv" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/admin/api/integrations/fanart", { apiKey: "secret-key" }),
    );
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("removes an existing fanart.tv configuration", async () => {
    const { client, del } = adminClient({ fanart: true });
    render(<Integrations admin={client} />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove fanart.tv" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/api/integrations/fanart"));
  });

  it("loads and saves the Discogs personal token without retaining the secret", async () => {
    const { client, get, put } = adminClient();
    render(<Integrations admin={client} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/api/integrations/discogs"));
    const input = screen.getByPlaceholderText("Discogs personal access token");
    expect(input.getAttribute("type")).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("off");
    fireEvent.change(input, { target: { value: "personal-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Discogs" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/admin/api/integrations/discogs", { personalToken: "personal-token" }),
    );
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("removes an existing Discogs configuration", async () => {
    const { client, del } = adminClient({ discogs: true });
    render(<Integrations admin={client} />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove Discogs" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/api/integrations/discogs"));
  });

  it("saves last.fm admin credentials and displays connected profiles", async () => {
    const { client, put } = adminClient({ lastfm: true });
    render(<Integrations admin={client} />);
    expect(await screen.findByText("2 connected profiles.")).toBeTruthy();
    fireEvent.change(screen.getAllByPlaceholderText("API key")[1], { target: { value: "key" } });
    fireEvent.change(screen.getByPlaceholderText("Shared secret"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save last.fm" }));
    await waitFor(() => expect(put).toHaveBeenCalledWith("/admin/api/integrations/lastfm", { apiKey: "key", sharedSecret: "secret" }));

  });

  it("confirms the profile impact before removing last.fm credentials", async () => {
    const { client, del } = adminClient({ lastfm: true });
    render(<Integrations admin={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove last.fm" }));

    expect(screen.getByRole("heading", { name: /remove last.fm/i })).toBeTruthy();
    expect(screen.getByText(/disconnect all 2 connected profiles/i)).toBeTruthy();
    expect(screen.getByText(/delete their personal last.fm linkage/i)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove last.fm" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove credentials" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/api/integrations/lastfm"));
  });

  it("isolates a Discogs loading failure from the other integrations", async () => {
    const { client, get } = adminClient({ lastfm: true });
    get.mockImplementation(async (path: string) => {
      if (path.endsWith("/discogs")) throw new Error("discogs unavailable");
      if (path.endsWith("/lastfm")) return { configured: true, connectedProfiles: 1 };
      return { configured: false };
    });
    render(<Integrations admin={client} />);
    expect(await screen.findByText("1 connected profile.")).toBeTruthy();
    expect(screen.getByText(/discogs: discogs unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/last.fm: discogs unavailable/i)).toBeNull();
    expect(screen.queryByText(/fanart.tv: discogs unavailable/i)).toBeNull();
  });
});
