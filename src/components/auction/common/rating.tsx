"use client";

import { memo, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価表示コンポーネントのprops
 */
type RatingDisplayProps = {
  rating: number;
  size?: number;
  readonly?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価表示コンポーネント
 * @param rating 評価
 * @param size サイズ
 * @param readonly 読み取り専用
 * @param onChange 評価変更時のコールバック
 */
export const Rating = memo(function Rating({ rating, size = 20, readonly = true, onChange, className }: RatingDisplayProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [hoverRating, setHoverRating] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleClick = useCallback(
    (index: number) => {
      if (readonly) return;
      onChange?.(index);
    },
    [readonly, onChange],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleMouseEnter = useCallback(
    (index: number) => {
      if (readonly) return;
      setHoverRating(index);
    },
    [readonly],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleMouseLeave = useCallback(() => {
    if (readonly) return;
    setHoverRating(0);
  }, [readonly]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={size}
          className={cn(
            `cursor-${readonly ? "default" : "pointer"}`,
            index <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300",
            className,
          )}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </div>
  );
});
