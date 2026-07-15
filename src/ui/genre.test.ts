import { describe, expect, it } from "vitest";
import { genreDisplayName } from "./genre";

describe("genreDisplayName", () => {
  it.each([
    ["alternative rock", "Alternative Rock"],
    ["synth-pop", "Synth-Pop"],
    ["r&b", "R&B"],
    ["drum/bass", "Drum/Bass"],
  ])("displays %s in title case", (genre, displayName) => {
    expect(genreDisplayName(genre)).toBe(displayName);
  });
});
