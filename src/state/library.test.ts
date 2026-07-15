import { describe, expect, it, vi } from "vitest";
import type { Artist, Track } from "../api/client";

const { invoke, listen } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import { beginLibrarySync, groupArtistsByGenre, groupTracksByCreditedArtist } from "./library";

describe("groupArtistsByGenre", () => {
  it("indexes, deduplicates, and sorts existing artist tags", () => {
    const ambient = { artistId: "ambient", name: "Ambient", genres: ["Electronic", "Ambient", "Ambient"] } as Artist;
    const techno = { artistId: "techno", name: "Techno", genres: ["Electronic", "  Techno  "] } as Artist;
    const untagged = { artistId: "untagged", name: "Untagged" } as Artist;

    const genres = groupArtistsByGenre([ambient, techno, untagged]);

    expect([...genres.keys()]).toEqual(["Ambient", "Electronic", "Techno"]);
    expect(genres.get("Electronic")).toEqual([ambient, techno]);
    expect(genres.get("Ambient")).toEqual([ambient]);
  });
});

describe("groupTracksByCreditedArtist", () => {
  it("includes guest appearances and deduplicates repeated artist credits", () => {
    const track = {
      trackId: "trk-1",
      artistCredits: [
        { artistId: "art-main", name: "Main", joinPhrase: " feat. " },
        { artistId: "art-guest", name: "Guest", joinPhrase: " & " },
        { artistId: "art-guest", name: "Guest", joinPhrase: "" },
      ],
    } as Track;

    const index = groupTracksByCreditedArtist([track]);
    expect(index.get("art-main")).toEqual([track]);
    expect(index.get("art-guest")).toEqual([track]);
  });
});

describe("beginLibrarySync", () => {
  it("registers for mirror changes before configuration can emit them", async () => {
    let finishListening!: (unlisten: () => void) => void;
    listen.mockReturnValueOnce(new Promise((resolve) => { finishListening = resolve; }));
    invoke.mockResolvedValueOnce(undefined);
    const load = vi.fn(async () => {});
    const connection = {
      kind: "local",
      client: { baseUrl: "http://127.0.0.1:8484", authToken: "token" },
    } as Parameters<typeof beginLibrarySync>[0];

    const started = beginLibrarySync(connection, load);
    await Promise.resolve();
    expect(listen).toHaveBeenCalledWith("library:changed", expect.any(Function));
    expect(invoke).not.toHaveBeenCalled();

    finishListening(() => {});
    await started;
    expect(invoke).toHaveBeenCalledWith("library_configure", {
      baseUrl: "http://127.0.0.1:8484",
      token: "token",
      identity: "local",
    });
    expect(load).toHaveBeenCalledOnce();
  });
});
