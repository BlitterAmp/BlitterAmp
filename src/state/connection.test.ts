import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, unknown>();
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (k: string) => mem.get(k),
    set: async (k: string, v: unknown) => void mem.set(k, v),
    delete: async (k: string) => void mem.delete(k),
    save: async () => {},
  }),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: Parameters<typeof fetch>) => fetch(...a) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// A predictable local engine.
const startEngine = vi.fn(async () => ({
  client: new (await import("../api/client")).Client("http://127.0.0.1:55555", "engine-tok"),
  info: { base_url: "http://127.0.0.1:55555", profile_token: "engine-tok", profile_name: "Me" },
}));
vi.mock("./engine", () => ({ startEngine: () => startEngine() }));

import { resolveConnection } from "./connection";
import { saveSession } from "./session";

describe("resolveConnection", () => {
  beforeEach(() => {
    mem.clear();
    startEngine.mockClear();
    vi.unstubAllGlobals();
  });

  it("defaults to the local engine with nothing saved", async () => {
    const c = await resolveConnection();
    expect(c.kind).toBe("local");
    expect(c.admin).toBeDefined();
    expect(startEngine).toHaveBeenCalledOnce();
  });

  it("uses a saved remote session that still validates", async () => {
    await saveSession({ serverUrl: "http://remote", deviceToken: "d", profileToken: "p", managed: false, profile: { profileId: "prf_1", name: "You", hasPin: false } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ device: {} }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const c = await resolveConnection();
    expect(c.kind).toBe("remote");
    expect(c.remoteUrl).toBe("http://remote");
    expect(c.admin).toBeUndefined();
    expect(startEngine).not.toHaveBeenCalled();
  });

  it("falls back to local when the saved remote is unreachable", async () => {
    await saveSession({ serverUrl: "http://remote", deviceToken: "d", profileToken: "p", managed: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const c = await resolveConnection();
    expect(c.kind).toBe("local");
    expect(startEngine).toHaveBeenCalledOnce();
  });
});
