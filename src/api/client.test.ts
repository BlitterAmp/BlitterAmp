import { describe, expect, it, vi } from "vitest";

// The Tauri HTTP plugin isn't available under vitest; substitute global fetch.
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import { ApiError, Client } from "./client";

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("Client", () => {
  it("builds URLs against the trimmed base", () => {
    const c = new Client("https://music.example.net/");
    expect(c.url("/v1/ping")).toBe("https://music.example.net/v1/ping");
  });

  it("sends the bearer token and parses JSON", async () => {
    const fn = stubFetch(200, { name: "BlitterServer", version: "1", setupComplete: true });
    const c = new Client("http://s", "tok123");
    const ping = await c.ping();
    expect(ping.name).toBe("BlitterServer");
    const [, opts] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("raises ApiError with the problem code", async () => {
    stubFetch(401, { title: "Unauthorized", status: 401, code: "invalid_token" });
    const c = new Client("http://s", "bad");
    const err = await c.listProfiles().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("invalid_token");
  });

  it("treats 204 as null", async () => {
    stubFetch(204);
    const c = new Client("http://s", "t");
    expect(await c.post("/v1/x")).toBeNull();
  });
});
