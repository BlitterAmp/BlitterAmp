import { Frown, Heart, Minus } from "lucide-react";
import type { LoveState } from "../api/client";

export function LoveControl({
  state = "neutral",
  onChange,
  size = 15,
  label = "Taste",
}: {
  state?: LoveState;
  onChange: (state: LoveState) => void;
  size?: number;
  label?: string;
}) {
  const choices: { state: LoveState; label: string; icon: typeof Heart }[] = [
    { state: "loved", label: "Love", icon: Heart },
    { state: "neutral", label: "Neutral", icon: Minus },
    { state: "not_for_me", label: "Not for me", icon: Frown },
  ];

  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center rounded-md bg-base-200/70 p-0.5">
      {choices.map((choice) => {
        const selected = state === choice.state;
        const Icon = choice.icon;
        return (
          <button
            key={choice.state}
            type="button"
            aria-label={choice.label}
            aria-pressed={selected}
            title={choice.label}
            className={`rounded p-1 transition ${
              selected
                ? choice.state === "not_for_me"
                  ? "bg-error/20 text-error"
                  : choice.state === "loved"
                    ? "bg-primary/20 text-primary"
                    : "bg-base-300 text-base-content"
                : "text-base-content/35 hover:text-base-content/70"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onChange(choice.state);
            }}
          >
            <Icon size={size} className={selected && choice.state === "loved" ? "fill-current" : ""} />
          </button>
        );
      })}
    </div>
  );
}
