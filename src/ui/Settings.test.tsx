// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "../api/client";
import type { Connection } from "../state/connection";
import { Settings } from "./Settings";

vi.mock("./settings/LastfmAccount", () => ({ LastfmAccount: () => <div>Profile last.fm account</div> }));

afterEach(cleanup);

describe("Settings", () => {
  it.each(["local", "remote"] as const)("shows the personal account for a %s connection", (kind) => {
    const connection: Connection = {
      kind,
      client: new Client("http://server", "token"),
      profileName: "Me",
      ...(kind === "remote" ? { remoteUrl: "http://server" } : {}),
    };
    render(<Settings connection={connection} onConnectionChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Profile last.fm account")).toBeTruthy();
  });
});
