import { Heart } from "lucide-react";
import type { LoveState } from "../api/client";

export function LoveButton({
  state,
  onChange,
  size = 15,
}: {
  state: LoveState | undefined;
  onChange: (state: LoveState) => void;
  size?: number;
}) {
  const loved = state === "loved";
  return (
    <button
      type="button"
      className={`p-1 leading-none ${loved ? "text-primary" : "text-base-content/40 hover:text-base-content/70"}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(loved ? "neutral" : "loved");
      }}
      aria-label={loved ? "Unlove" : "Love"}
    >
      <Heart size={size} className={loved ? "fill-primary" : ""} />
    </button>
  );
}
