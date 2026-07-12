// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoveControl } from "./LoveControl";

afterEach(cleanup);

describe("LoveControl", () => {
  it("exposes and selects all three taste states", () => {
    const onChange = vi.fn();
    const { rerender } = render(<LoveControl state="neutral" onChange={onChange} />);

    expect(screen.getByRole("group", { name: "Taste" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Neutral" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    expect(onChange).toHaveBeenCalledWith("loved");

    rerender(<LoveControl state="not_for_me" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Not for me" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Neutral" }));
    expect(onChange).toHaveBeenLastCalledWith("neutral");
  });
});
