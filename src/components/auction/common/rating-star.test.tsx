import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { RatingStar } from "./rating-star";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * RatingStarコンポーネントのテスト
 */
describe("RatingStar", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的な表示機能のテスト
   */
  describe("基本表示", () => {
    test("should render 5 stars", () => {
      const { container } = render(<RatingStar rating={3} />);

      // 5つの星が表示されることを確認
      const stars = container.querySelectorAll("svg");
      expect(stars).toHaveLength(5);
    });

    test("should apply correct rating display", () => {
      const { container } = render(<RatingStar rating={3} />);

      const containerDiv = container.querySelector("div");
      expect(containerDiv).toBeInTheDocument();
    });

    test("should apply default size when size prop is not provided", () => {
      const { container } = render(<RatingStar rating={3} />);

      const stars = container.querySelectorAll("svg");
      // デフォルトサイズ20が適用されることを確認
      stars.forEach((star: Element) => {
        expect(star).toHaveAttribute("width", "20");
        expect(star).toHaveAttribute("height", "20");
      });
    });

    test("should apply custom size when size prop is provided", () => {
      const customSize = 30;
      const { container } = render(<RatingStar rating={3} size={customSize} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveAttribute("width", customSize.toString());
        expect(star).toHaveAttribute("height", customSize.toString());
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価表示のテスト
   */
  describe("評価表示", () => {
    test("should display correct rating with filled stars", () => {
      const { container } = render(<RatingStar rating={3} />);

      const stars = container.querySelectorAll("svg");

      // 最初の3つの星が黄色（filled）であることを確認
      for (let i = 0; i < 3; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      // 残りの2つの星がグレーであることを確認
      for (let i = 3; i < 5; i++) {
        expect(stars[i]).toHaveClass("text-gray-300");
        expect(stars[i]).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      }
    });

    test("should handle rating of 0", () => {
      const { container } = render(<RatingStar rating={0} />);

      const stars = container.querySelectorAll("svg");

      // すべての星がグレーであることを確認
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("text-gray-300");
        expect(star).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should handle rating of 5", () => {
      const { container } = render(<RatingStar rating={5} />);

      const stars = container.querySelectorAll("svg");

      // すべての星が黄色であることを確認
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should handle decimal rating by rounding down", () => {
      const { container } = render(<RatingStar rating={3.7} />);

      const stars = container.querySelectorAll("svg");

      // 3つの星が黄色であることを確認（小数点以下は切り捨て）
      for (let i = 0; i < 3; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      for (let i = 3; i < 5; i++) {
        expect(stars[i]).toHaveClass("text-gray-300");
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 読み取り専用モードのテスト
   */
  describe("読み取り専用モード", () => {
    test("should apply default cursor style when readonly is true", () => {
      const { container } = render(<RatingStar rating={3} readonly={true} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("cursor-default");
      });
    });

    test("should not call onChange when clicked in readonly mode", () => {
      const mockOnChange = vi.fn();
      const { container } = render(<RatingStar rating={3} readonly={true} onChange={mockOnChange} />);

      const stars = container.querySelectorAll("svg");
      fireEvent.click(stars[4]); // 5番目の星をクリック

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test("should not update hover state when mouse enters in readonly mode", () => {
      const { container } = render(<RatingStar rating={2} readonly={true} />);

      const stars = container.querySelectorAll("svg");

      // 4番目の星にマウスオーバー
      fireEvent.mouseEnter(stars[3]);

      // 元の評価（2つの星）のままであることを確認
      for (let i = 0; i < 2; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      for (let i = 2; i < 5; i++) {
        expect(stars[i]).toHaveClass("text-gray-300");
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * インタラクティブモードのテスト
   */
  describe("インタラクティブモード", () => {
    test("should apply pointer cursor style when readonly is false", () => {
      const { container } = render(<RatingStar rating={3} readonly={false} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("cursor-pointer");
      });
    });

    test("should call onChange with correct rating when star is clicked", () => {
      const mockOnChange = vi.fn();
      const { container } = render(<RatingStar rating={2} readonly={false} onChange={mockOnChange} />);

      const stars = container.querySelectorAll("svg");

      // 4番目の星をクリック（rating = 4）
      fireEvent.click(stars[3]);

      expect(mockOnChange).toHaveBeenCalledWith(4);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    test("should call onChange multiple times for different star clicks", () => {
      const mockOnChange = vi.fn();
      const { container } = render(<RatingStar rating={1} readonly={false} onChange={mockOnChange} />);

      const stars = container.querySelectorAll("svg");

      // 複数の星をクリック
      fireEvent.click(stars[2]); // rating = 3
      fireEvent.click(stars[4]); // rating = 5
      fireEvent.click(stars[0]); // rating = 1

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenNthCalledWith(1, 3);
      expect(mockOnChange).toHaveBeenNthCalledWith(2, 5);
      expect(mockOnChange).toHaveBeenNthCalledWith(3, 1);
    });

    test("should not call onChange when onChange prop is not provided", () => {
      // onChangeが提供されていない場合でもエラーが発生しないことを確認
      expect(() => {
        const { container } = render(<RatingStar rating={3} readonly={false} />);
        const stars = container.querySelectorAll("svg");
        fireEvent.click(stars[2]);
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ホバー機能のテスト
   */
  describe("ホバー機能", () => {
    test("should update display when mouse enters star in interactive mode", () => {
      const { container } = render(<RatingStar rating={2} readonly={false} />);

      const stars = container.querySelectorAll("svg");

      // 4番目の星にマウスオーバー
      fireEvent.mouseEnter(stars[3]);

      // ホバー効果で4つの星が黄色になることを確認
      for (let i = 0; i < 4; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      expect(stars[4]).toHaveClass("text-gray-300");
    });

    test("should reset to original rating when mouse leaves in interactive mode", () => {
      const { container } = render(<RatingStar rating={2} readonly={false} />);

      const stars = container.querySelectorAll("svg");

      // 4番目の星にマウスオーバー
      fireEvent.mouseEnter(stars[3]);

      // マウスアウト
      fireEvent.mouseLeave(stars[3]);

      // 元の評価（2つの星）に戻ることを確認
      for (let i = 0; i < 2; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      for (let i = 2; i < 5; i++) {
        expect(stars[i]).toHaveClass("text-gray-300");
      }
    });

    test("should handle sequential mouse enter events", () => {
      const { container } = render(<RatingStar rating={1} readonly={false} />);

      const stars = container.querySelectorAll("svg");

      // 3番目の星にマウスオーバー
      fireEvent.mouseEnter(stars[2]);

      // 3つの星が黄色になることを確認
      for (let i = 0; i < 3; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      // 5番目の星にマウスオーバー
      fireEvent.mouseEnter(stars[4]);

      // 5つの星すべてが黄色になることを確認
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should clamp negative rating to 0", () => {
      const { container } = render(<RatingStar rating={-1} />);

      const stars = container.querySelectorAll("svg");

      // すべての星がグレーであることを確認（rating -1 は 0 にクランプされる）
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("text-gray-300");
        expect(star).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should clamp very negative rating to 0", () => {
      const { container } = render(<RatingStar rating={-100} />);

      const stars = container.querySelectorAll("svg");

      // すべての星がグレーであることを確認（rating -100 は 0 にクランプされる）
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("text-gray-300");
        expect(star).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should clamp rating greater than 5 to 5", () => {
      const { container } = render(<RatingStar rating={7} />);

      const stars = container.querySelectorAll("svg");

      // すべての星が黄色であることを確認（rating 7 は 5 にクランプされる）
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should clamp very large rating to 5", () => {
      const { container } = render(<RatingStar rating={1000} />);

      const stars = container.querySelectorAll("svg");

      // すべての星が黄色であることを確認（rating 1000 は 5 にクランプされる）
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should handle exact boundary values correctly", () => {
      // rating = 0 のテスト
      const { container: container0 } = render(<RatingStar rating={0} />);
      const stars0 = container0.querySelectorAll("svg");
      stars0.forEach((star: Element) => {
        expect(star).toHaveClass("text-gray-300");
        expect(star).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      });

      // rating = 5 のテスト
      const { container: container5 } = render(<RatingStar rating={5} />);
      const stars5 = container5.querySelectorAll("svg");
      stars5.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should handle decimal values within range correctly", () => {
      const { container } = render(<RatingStar rating={3.7} />);

      const stars = container.querySelectorAll("svg");

      // 3つの星が黄色であることを確認（小数点以下は切り捨て）
      for (let i = 0; i < 3; i++) {
        expect(stars[i]).toHaveClass("fill-yellow-400", "text-yellow-400");
      }

      for (let i = 3; i < 5; i++) {
        expect(stars[i]).toHaveClass("text-gray-300");
      }
    });

    test("should clamp decimal values outside range", () => {
      // rating = -0.5 のテスト（0にクランプされる）
      const { container: containerNegative } = render(<RatingStar rating={-0.5} />);
      const starsNegative = containerNegative.querySelectorAll("svg");
      starsNegative.forEach((star: Element) => {
        expect(star).toHaveClass("text-gray-300");
        expect(star).not.toHaveClass("fill-yellow-400", "text-yellow-400");
      });

      // rating = 5.5 のテスト（5にクランプされる）
      const { container: containerOver } = render(<RatingStar rating={5.5} />);
      const starsOver = containerOver.querySelectorAll("svg");
      starsOver.forEach((star: Element) => {
        expect(star).toHaveClass("fill-yellow-400", "text-yellow-400");
      });
    });

    test("should handle size of 0", () => {
      const { container } = render(<RatingStar rating={3} size={0} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveAttribute("width", "0");
        expect(star).toHaveAttribute("height", "0");
      });
    });

    test("should handle very large size", () => {
      const largeSize = 1000;
      const { container } = render(<RatingStar rating={3} size={largeSize} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveAttribute("width", largeSize.toString());
        expect(star).toHaveAttribute("height", largeSize.toString());
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * プロパティのデフォルト値テスト
   */
  describe("デフォルト値", () => {
    test("should use default readonly value (true) when not specified", () => {
      const mockOnChange = vi.fn();
      const { container } = render(<RatingStar rating={3} onChange={mockOnChange} />);

      const stars = container.querySelectorAll("svg");

      // デフォルトでreadonlyがtrueなので、クリックしても何も起こらない
      fireEvent.click(stars[4]);
      expect(mockOnChange).not.toHaveBeenCalled();

      // カーソルスタイルもdefaultになる
      stars.forEach((star: Element) => {
        expect(star).toHaveClass("cursor-default");
      });
    });

    test("should use default size value (20) when not specified", () => {
      const { container } = render(<RatingStar rating={3} />);

      const stars = container.querySelectorAll("svg");
      stars.forEach((star: Element) => {
        expect(star).toHaveAttribute("width", "20");
        expect(star).toHaveAttribute("height", "20");
      });
    });
  });
});
