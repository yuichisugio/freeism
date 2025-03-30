"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type RatingDisplayProps = {
  rating: number;
  size?: number;
  readonly?: boolean;
  onChange?: (rating: number) => void;
};

export function Rating({ rating, size = 20, readonly = true, onChange }: RatingDisplayProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (index: number) => {
    if (readonly) return;
    onChange?.(index);
  };

  const handleMouseEnter = (index: number) => {
    if (readonly) return;
    setHoverRating(index);
  };

  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverRating(0);
  };

  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={size}
          className={`cursor-${readonly ? "default" : "pointer"} ${index <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </div>
  );
}
