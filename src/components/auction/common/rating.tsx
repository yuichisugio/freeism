"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type RatingDisplayProps = {
  rating: number;
  size?: number;
  readonly?: boolean;
  onChange?: (rating: number) => void;
};

/**
 * 評価表示コンポーネント
 * @param rating 評価
 * @param size サイズ
 * @param readonly 読み取り専用
 * @param onChange 評価変更時のコールバック
 */
export function Rating({ rating, size = 20, readonly = true, onChange }: RatingDisplayProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const [hoverRating, setHoverRating] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleClick = (index: number) => {
    if (readonly) return;
    onChange?.(index);
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleMouseEnter = (index: number) => {
    if (readonly) return;
    setHoverRating(index);
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverRating(0);
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
