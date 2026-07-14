// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client, ServerStatus } from "../api/client";
import { ServerStatusProvider, useServerStatus } from "./serverStatus";

const idle: ServerStatus = {
  version: "1",
  setupComplete: true,
  source: { kind: "filesystem", connected: true },
  activity: null,
};
const running: ServerStatus = {
  ...idle,
  activity: {
    stage: "filesystem_scan",
    state: "running",
    startedAt: "2026-07-14T00:00:00Z",
    updatedAt: "2026-07-14T00:00:01Z",
    counts: { discovered: 4, reused: 2 },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockClient(status: () => Promise<ServerStatus>): Client {
  return { status } as Client;
}

function Consumer({ name = "status" }: { name?: string }) {
  const status = useServerStatus();
  return <output aria-label={name}>{status?.activity?.state ?? (status ? "idle" : "unknown")}</output>;
}

function Wrapper({ client, children }: { client: Client; children?: ReactNode }) {
  return <ServerStatusProvider client={client}>{children ?? <Consumer />}</ServerStatusProvider>;
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServerStatusProvider", () => {
  it("polls immediately and adapts between running and idle cadence", async () => {
    const status = vi.fn<() => Promise<ServerStatus>>().mockResolvedValueOnce(running).mockResolvedValue(idle);
    render(<Wrapper client={mockClient(status)} />);

    expect(status).toHaveBeenCalledOnce();
    await advance(0);
    expect(screen.getByLabelText("status").textContent).toBe("running");
    await advance(1_999);
    expect(status).toHaveBeenCalledOnce();
    await advance(1);
    expect(status).toHaveBeenCalledTimes(2);
    await advance(5_000);
    expect(status).toHaveBeenCalledTimes(3);
  });

  it("waits for a request to settle before scheduling another", async () => {
    const request = deferred<ServerStatus>();
    const status = vi.fn(() => request.promise);
    render(<Wrapper client={mockClient(status)} />);

    await advance(9_000);
    expect(status).toHaveBeenCalledOnce();
    request.resolve(running);
    await advance(1_999);
    expect(status).toHaveBeenCalledOnce();
    await advance(1);
    expect(status).toHaveBeenCalledTimes(2);
  });

  it("deduplicates StrictMode's simultaneous initial request", async () => {
    const request = deferred<ServerStatus>();
    const status = vi.fn(() => request.promise);
    render(
      <StrictMode>
        <Wrapper client={mockClient(status)} />
      </StrictMode>,
    );

    expect(status).toHaveBeenCalledOnce();
    request.resolve(idle);
    await advance(0);
    expect(screen.getByLabelText("status").textContent).toBe("idle");
  });

  it("resets for a replacement client and ignores the stale response", async () => {
    const oldRequest = deferred<ServerStatus>();
    const oldStatus = vi.fn(() => oldRequest.promise);
    const newStatus = vi.fn(async () => idle);
    const { rerender } = render(<Wrapper client={mockClient(oldStatus)} />);

    rerender(<Wrapper client={mockClient(newStatus)} />);
    await advance(0);
    expect(newStatus).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("status").textContent).toBe("idle");

    oldRequest.resolve(running);
    await advance(0);
    expect(screen.getByLabelText("status").textContent).toBe("idle");
  });

  it("clears stale status after failure and recovers on the idle retry cadence", async () => {
    const status = vi
      .fn<() => Promise<ServerStatus>>()
      .mockResolvedValueOnce(running)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(idle);
    render(<Wrapper client={mockClient(status)} />);

    await advance(0);
    expect(screen.getByLabelText("status").textContent).toBe("running");
    await advance(2_000);
    expect(screen.getByLabelText("status").textContent).toBe("unknown");
    await advance(5_000);
    expect(screen.getByLabelText("status").textContent).toBe("idle");
  });

  it("aborts a hung request, clears stale activity, and retries after it settles", async () => {
    let hungSignal: AbortSignal | undefined;
    const status = vi
      .fn<Client["status"]>()
      .mockResolvedValueOnce(running)
      .mockImplementationOnce((signal) => {
        hungSignal = signal;
        return new Promise(() => {});
      })
      .mockResolvedValueOnce(idle);
    render(<Wrapper client={mockClient(status)} />);

    await advance(0);
    await advance(2_000);
    expect(status).toHaveBeenCalledTimes(2);
    expect(hungSignal?.aborted).toBe(false);

    await advance(9_999);
    expect(status).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("status").textContent).toBe("running");
    await advance(1);
    expect(hungSignal?.aborted).toBe(true);
    expect(screen.getByLabelText("status").textContent).toBe("unknown");

    await advance(4_999);
    expect(status).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(status).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText("status").textContent).toBe("idle");
  });

  it("does not update or schedule after unmount", async () => {
    const request = deferred<ServerStatus>();
    const status = vi.fn(() => request.promise);
    const view = render(<Wrapper client={mockClient(status)} />);

    view.unmount();
    request.resolve(running);
    await advance(20_000);
    expect(status).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one polling stream between multiple consumers", async () => {
    const status = vi.fn(async () => running);
    render(
      <Wrapper client={mockClient(status)}>
        <Consumer name="first" />
        <Consumer name="second" />
      </Wrapper>,
    );

    await advance(0);
    expect(status).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("first").textContent).toBe("running");
    expect(screen.getByLabelText("second").textContent).toBe("running");
  });
});
