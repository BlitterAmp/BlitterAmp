// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminClient } from "../../admin/adminClient";
import { Integrations } from "./Integrations";

afterEach(cleanup);

function adminClient(configured = false) {
  const get = vi.fn(async (path: string) => {
    if (path.endsWith("/lidarr")) return { configured: false };
    if (path.endsWith("/lastfm")) return { configured: false };
    if (path.endsWith("/fanart")) return { configured };
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
    const { client, del } = adminClient(true);
    render(<Integrations admin={client} />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove fanart.tv" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/api/integrations/fanart"));
  });
});
