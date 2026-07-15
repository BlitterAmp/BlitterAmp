// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./AlbumArt", () => ({
  AlbumArt: ({ artId, alt }: { artId?: string; alt: string }) => <span data-testid="tile" data-art-id={artId} data-alt={alt} />,
}));

import { MosaicArt } from "./MosaicArt";

afterEach(cleanup);

describe("MosaicArt", () => {
  it.each([
    [4, "grid-cols-2"],
    [9, "grid-cols-3"],
    [12, "grid-cols-4"],
  ])("renders an adaptive %i-cover mosaic", (count, gridClass) => {
    render(<MosaicArt artIds={Array.from({ length: count }, (_, index) => `art-${index}`)} adaptive alt="Electronica" />);

    expect(screen.getAllByTestId("tile")).toHaveLength(count);
    expect(screen.getByRole("img", { name: "Electronica" }).classList.contains(gridClass)).toBe(true);
  });

  it("keeps a single cover full size", () => {
    render(<MosaicArt artIds={[null, "only", "only"]} adaptive alt="Ambient" />);
    expect(screen.getAllByTestId("tile")).toHaveLength(1);
    expect(screen.getByTestId("tile").getAttribute("data-art-id")).toBe("only");
  });
});
