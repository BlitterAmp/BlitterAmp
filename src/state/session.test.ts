import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the Tauri plugins.
const memory = new Map<string, unknown>();
let saveCount = 0;
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (k: string) => memory.get(k),
    set: async (k: string, v: unknown) => void memory.set(k, v),
    delete: async (k: string) => void memory.delete(k),
    save: async () => void (saveCount += 1),
  }),
}));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import { restore, saveSession } from "./session";

function respond(handler: (url: string) => { status: number; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const { status, body } = handler(url.toString());
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("session restore", () => {
  beforeEach(() => {
    memory.clear();
    saveCount = 0;
    vi.unstubAllGlobals();
  });

  it("returns none with nothing saved", async () => {
    expect((await restore()).kind).toBe("none");
  });

  it("saves immediately (device tokens are delivered exactly once)", async () => {
    await saveSession({ serverUrl: "http://s", deviceToken: "dev" });
    expect(saveCount).toBeGreaterThan(0);
    expect((memory.get("session") as { deviceToken: string }).deviceToken).toBe("dev");
    expect(memory.get("lastServerUrl")).toBe("http://s");
  });

  it("restores a working profile token straight to the app", async () => {
    await saveSession({ serverUrl: "http://s", deviceToken: "dev", profileToken: "prof" });
    respond(() => ({ status: 200, body: { device: { deviceId: "dev_x" } } }));
    const out = await restore(1, 0);
    expect(out.kind).toBe("profile");
  });

  it("falls back to the device token when the profile token is revoked", async () => {
    await saveSession({ serverUrl: "http://s", deviceToken: "dev", profileToken: "dead" });
    respond(() => ({ status: 200 }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: RequestInit) => {
        const auth = (opts?.headers as Record<string, string>)?.Authorization ?? "";
        if (auth.includes("dead")) {
          return new Response(JSON.stringify({ title: "Unauthorized", status: 401, code: "invalid_token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ device: { deviceId: "dev_x" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const out = await restore(1, 0);
    expect(out.kind).toBe("device");
  });

  it("clears the session when the device token itself is revoked", async () => {
    await saveSession({ serverUrl: "http://s", deviceToken: "dead", profileToken: "dead" });
    respond(() => ({ status: 401, body: { title: "Unauthorized", status: 401, code: "invalid_token" } }));
    const out = await restore(1, 0);
    expect(out.kind).toBe("none");
    expect(memory.get("session")).toBeUndefined();
  });

  it("keeps the session on network failure (server just not up yet)", async () => {
    await saveSession({ serverUrl: "http://s", deviceToken: "dev", profileToken: "prof" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    const out = await restore(1, 0);
    expect(out.kind).toBe("none");
    expect(memory.get("session")).toBeDefined();
  });
});

describe("managed marker", () => {
  beforeEach(() => {
    memory.clear();
    saveCount = 0;
    vi.unstubAllGlobals();
  });

  it("round-trips a managed session that restore skips (engine handles it)", async () => {
    const { saveManagedMarker, loadSession } = await import("./session");
    await saveManagedMarker("Me");
    const saved = await loadSession();
    expect(saved?.managed).toBe(true);
    expect(saved?.profile?.name).toBe("Me");
    // restore() must not try to validate a managed session over HTTP.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("should not be called"); }));
    expect((await restore(1, 0)).kind).toBe("none");
  });
});
