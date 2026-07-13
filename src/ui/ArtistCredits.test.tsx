// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtistCredits } from "./ArtistCredits";

afterEach(cleanup);

describe("ArtistCredits", () => {
  it("preserves credited names and join phrases and navigates independently", () => {
    const onOpenArtist = vi.fn();
    const { container } = render(
      <ArtistCredits
        credits={[
          { artistId: "art-1", name: "One", joinPhrase: " feat. " },
          { artistId: "art-2", name: "Two", joinPhrase: " & " },
          { artistId: "art-3", name: "Three", joinPhrase: "" },
        ]}
        onOpenArtist={onOpenArtist}
      />,
    );

    expect(container.textContent).toBe("One feat. Two & Three");
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(onOpenArtist).toHaveBeenCalledWith("art-2");
  });

  it("does not propagate double clicks to a containing track row", () => {
    const onDoubleClick = vi.fn();
    render(
      <div onDoubleClick={onDoubleClick}>
        <ArtistCredits credits={[{ artistId: "art-1", name: "One", joinPhrase: "" }]} onOpenArtist={vi.fn()} />
      </div>,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "One" }));
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
});
