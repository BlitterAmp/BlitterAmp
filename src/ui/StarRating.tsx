import { Star } from "lucide-react";
import { useState } from "react";

/** 5 stars over a 0–10 scale (each star = 2 points). Click a star to set;
 * click the current top star to clear. */
export function StarRating({
  rating10,
  onChange,
  size = 14,
}: {
  rating10: number;
  onChange: (rating10: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || rating10;
  return (
    <div className="flex" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const value = star * 2;
        return (
          <button
            key={star}
            type="button"
            className="p-0.5 leading-none"
            onMouseEnter={() => setHover(value)}
            onClick={(e) => {
              e.stopPropagation();
              onChange(rating10 === value ? 0 : value);
            }}
            aria-label={`${star} stars`}
          >
            <Star
              size={size}
              className={shown >= value ? "fill-warning text-warning" : "text-base-content/25"}
            />
          </button>
        );
      })}
    </div>
  );
}
