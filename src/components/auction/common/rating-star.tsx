"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Star } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価表示コンポーネントのprops
 */
type RatingDisplayProps = {
  rating?: number;
  size?: number;
  readonly?: boolean;
  onChange?: (rating: number) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価表示コンポーネント
 * @param rating 評価
 * @param size サイズ
 * @param readonly 読み取り専用
 * @param onChange 評価変更時のコールバック
 */
export const RatingStar = memo(function RatingStar({ rating = 0, size = 20, readonly = true, onChange }: RatingDisplayProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価値を0以上5以下の範囲に制限
   * 呼び出す側で0以下・5以上が渡されても正常に動くように実装
   */
  const clampedRating = useMemo(() => Math.max(0, Math.min(5, rating)), [rating]);

  /**
   * ホバー評価
   */
  const [hoverRating, setHoverRating] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価クリック時のコールバック
   */
  const handleClick = useCallback(
    (index: number) => {
      if (readonly) return;
      onChange?.(index);
    },
    [readonly, onChange],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価マウスオーバー時のコールバック
   */
  const handleMouseEnter = useCallback(
    (index: number) => {
      if (readonly) return;
      setHoverRating(index);
    },
    [readonly],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価マウスアウト時のコールバック
   */
  const handleMouseLeave = useCallback(() => {
    if (readonly) return;
    setHoverRating(0);
  }, [readonly]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価表示コンポーネント
   */
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={size}
          data-testid="star-icon"
          className={`cursor-${readonly ? "default" : "pointer"} ${index <= (hoverRating || clampedRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </div>
  );
});
