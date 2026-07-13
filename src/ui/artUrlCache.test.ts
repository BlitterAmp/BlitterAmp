import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtUrlCache } from "./artUrlCache";

describe("ArtUrlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("revokes the least recently used URL on eviction", async () => {
    const revoke = vi.fn();
    const cache = new ArtUrlCache(2, 10_000, revoke);

    await cache.get("a", () => Promise.resolve("blob:a"));
    await cache.get("b", () => Promise.resolve("blob:b"));
    await cache.get("a", () => Promise.resolve("unused"));
    await cache.get("c", () => Promise.resolve("blob:c"));

    expect(revoke).toHaveBeenCalledWith("blob:b");
    expect(revoke).not.toHaveBeenCalledWith("blob:a");
  });

  it("keeps failures negative until the TTL expires", async () => {
    const load = vi.fn().mockRejectedValue(new Error("missing"));
    const cache = new ArtUrlCache(2, 120_000, vi.fn());

    await expect(cache.get("missing", load)).rejects.toThrow("missing");
    await expect(cache.get("missing", load)).rejects.toThrow("missing");
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(120_001);
    await expect(cache.get("missing", load)).rejects.toThrow("missing");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("clears negative entries on invalidation without revoking live URLs", async () => {
    const revoke = vi.fn();
    const cache = new ArtUrlCache(2, 120_000, revoke);
    const missing = vi.fn().mockRejectedValue(new Error("missing"));
    await cache.get("live", () => Promise.resolve("blob:live"));
    await expect(cache.get("missing", missing)).rejects.toThrow("missing");

    cache.invalidateNegatives();
    await expect(cache.get("missing", missing)).rejects.toThrow("missing");

    expect(missing).toHaveBeenCalledTimes(2);
    expect(revoke).not.toHaveBeenCalled();
  });
});
