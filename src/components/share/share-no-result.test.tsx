import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoResult } from "./share-no-result";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// 基本レンダリングテスト
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("NoResult", () => {
  describe("正常系テスト", () => {
    it("should render component with message", () => {
      const testMessage = "データが見つかりません";

      render(<NoResult message={testMessage} />);

      // メッセージが表示されることを確認
      expect(screen.getByText(testMessage)).toBeInTheDocument();
    });

    it("should render with default styling when no className provided", () => {
      const testMessage = "テストメッセージ";

      const { container } = render(<NoResult message={testMessage} />);

      // ルートコンテナ要素（最初のdiv）のクラスを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("flex", "h-full", "w-full", "flex-col", "items-center", "justify-center", "gap-4", "py-8");
    });

    it("should render with custom className applied", () => {
      const testMessage = "カスタムクラステスト";
      const customClass = "bg-red-100 custom-class";

      const { container } = render(<NoResult message={testMessage} className={customClass} />);

      // カスタムクラスが適用されることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("bg-red-100", "custom-class");
      // デフォルトクラスも保持されることを確認
      expect(rootContainer).toHaveClass("flex", "h-full", "w-full", "flex-col", "items-center", "justify-center", "gap-4", "py-8");
    });

    it("should render FileX icon", () => {
      const testMessage = "アイコンテスト";

      render(<NoResult message={testMessage} />);

      // FileXアイコンが存在することを確認
      const iconContainer = document.querySelector(".bg-muted\\/30");
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass("rounded-full", "p-4");

      // SVGアイコンが存在することを確認
      const icon = document.querySelector(".text-muted-foreground.h-12.w-12");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Props境界値テスト", () => {
    it("should render with empty string message", () => {
      const emptyMessage = "";

      const { container } = render(<NoResult message={emptyMessage} />);

      // 空文字でもレンダリングされることを確認
      const messageElement = container.querySelector("p");
      expect(messageElement).toBeInTheDocument();
      expect(messageElement?.textContent).toBe("");
    });

    it("should render with very long message", () => {
      const longMessage = "a".repeat(1000);

      render(<NoResult message={longMessage} />);

      // 長いメッセージでもレンダリングされることを確認
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it("should render with special characters in message", () => {
      const specialMessage = "🚀 エラー & <script>alert('test')</script> 💻";

      render(<NoResult message={specialMessage} />);

      // 特殊文字が含まれたメッセージがレンダリングされることを確認
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it("should render with undefined className", () => {
      const testMessage = "undefinedクラステスト";

      const { container } = render(<NoResult message={testMessage} className={undefined} />);

      // undefinedのclassNameでも正常にレンダリングされることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("flex", "h-full", "w-full", "flex-col", "items-center", "justify-center", "gap-4", "py-8");
    });

    it("should render with empty string className", () => {
      const testMessage = "空文字クラステスト";

      const { container } = render(<NoResult message={testMessage} className="" />);

      // 空文字のclassNameでも正常にレンダリングされることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("flex", "h-full", "w-full", "flex-col", "items-center", "justify-center", "gap-4", "py-8");
    });

    it("should render with whitespace-only message", () => {
      const whitespaceMessage = "   \n\t   ";

      const { container } = render(<NoResult message={whitespaceMessage} />);

      // 空白文字のみのメッセージでもレンダリングされることを確認
      const messageElement = container.querySelector("p");
      expect(messageElement).toBeInTheDocument();
      expect(messageElement?.textContent).toBe(whitespaceMessage);
    });

    it("should render with numeric string message", () => {
      const numericMessage = "12345";

      render(<NoResult message={numericMessage} />);

      // 数字文字列でもレンダリングされることを確認
      expect(screen.getByText(numericMessage)).toBeInTheDocument();
    });

    it("should render with multiple spaces className", () => {
      const testMessage = "複数スペースクラステスト";
      const multiSpaceClass = "  class1   class2  ";

      const { container } = render(<NoResult message={testMessage} className={multiSpaceClass} />);

      // 複数スペースを含むclassNameでも正常に処理されることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toHaveClass("class1", "class2");
    });
  });

  describe("異常系テスト", () => {
    it("should handle conflicting CSS classes gracefully", () => {
      const testMessage = "競合CSSテスト";
      const conflictingClass = "flex-row justify-start items-start";

      const { container } = render(<NoResult message={testMessage} className={conflictingClass} />);

      // 競合するCSSクラスがある場合も正常にレンダリングされることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toBeInTheDocument();
      // cn関数によりTailwindの競合が適切に解決されることを確認
      expect(rootContainer).toHaveClass("flex-row", "justify-start", "items-start");
    });

    it("should handle extremely long className", () => {
      const testMessage = "極長クラス名テスト";
      const extremelyLongClass = "a".repeat(1000);

      const { container } = render(<NoResult message={testMessage} className={extremelyLongClass} />);

      // 極端に長いクラス名でも正常にレンダリングされることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer).toBeInTheDocument();
      expect(rootContainer).toHaveClass(extremelyLongClass);
    });
  });

  describe("DOM構造テスト", () => {
    it("should have correct DOM structure", () => {
      const testMessage = "構造テスト";

      const { container } = render(<NoResult message={testMessage} />);

      // ルートコンテナが存在することを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer.tagName).toBe("DIV");

      // アイコンコンテナが存在することを確認
      const iconContainer = rootContainer.querySelector(".bg-muted\\/30");
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer?.tagName).toBe("DIV");

      // テキストコンテナが存在することを確認
      const textContainer = rootContainer.querySelector(".text-center");
      expect(textContainer).toBeInTheDocument();
      expect(textContainer?.tagName).toBe("DIV");

      // メッセージ要素が存在することを確認
      const messageElement = textContainer?.querySelector("p");
      expect(messageElement).toBeInTheDocument();
      expect(messageElement?.textContent).toBe(testMessage);
    });

    it("should have correct CSS classes applied", () => {
      const testMessage = "CSSクラステスト";

      const { container } = render(<NoResult message={testMessage} />);

      const rootContainer = container.firstChild as HTMLElement;
      const iconContainer = rootContainer.querySelector(".bg-muted\\/30")!;
      const textContainer = rootContainer.querySelector(".text-center")!;
      const messageElement = textContainer.querySelector("p");

      // アイコンコンテナのクラス確認
      expect(iconContainer).toHaveClass("bg-muted/30", "rounded-full", "p-4");

      // テキストコンテナのクラス確認
      expect(textContainer).toHaveClass("text-center");

      // メッセージ要素のクラス確認
      expect(messageElement).toHaveClass("text-muted-foreground", "text-lg", "font-medium");
    });

    it("should have exactly one p element", () => {
      const testMessage = "単一p要素テスト";

      const { container } = render(<NoResult message={testMessage} />);

      // p要素が1つだけ存在することを確認
      const paragraphElements = container.querySelectorAll("p");
      expect(paragraphElements).toHaveLength(1);
      expect(paragraphElements[0].textContent).toBe(testMessage);
    });

    it("should have exactly one SVG icon", () => {
      const testMessage = "単一SVGテスト";

      const { container } = render(<NoResult message={testMessage} />);

      // SVG要素が1つだけ存在することを確認
      const svgElements = container.querySelectorAll("svg");
      expect(svgElements).toHaveLength(1);

      // FileX SVGの特定の要素が存在することを確認
      const svgPaths = svgElements[0].querySelectorAll("path");
      expect(svgPaths).toHaveLength(4); // FileXアイコンは4つのpathを持つ
    });
  });

  describe("アクセシビリティテスト", () => {
    it("should have proper semantic structure", () => {
      const testMessage = "アクセシビリティテスト";

      const { container } = render(<NoResult message={testMessage} />);

      // メッセージがp要素として適切にマークアップされていることを確認
      const messageElement = screen.getByText(testMessage);
      expect(messageElement.tagName).toBe("P");

      // コンテナがdiv要素として適切にマークアップされていることを確認
      const rootContainer = container.firstChild as HTMLElement;
      expect(rootContainer.tagName).toBe("DIV");
    });

    it("should not have any button or interactive elements", () => {
      const testMessage = "非インタラクティブテスト";

      const { container } = render(<NoResult message={testMessage} />);

      // ボタンやインタラクティブな要素が存在しないことを確認
      const buttons = container.querySelectorAll("button");
      const links = container.querySelectorAll("a");
      const inputs = container.querySelectorAll("input");

      expect(buttons).toHaveLength(0);
      expect(links).toHaveLength(0);
      expect(inputs).toHaveLength(0);
    });
  });

  describe("cn関数統合テスト", () => {
    it("should properly merge default and custom classes using cn", () => {
      const testMessage = "cn関数テスト";
      const customClasses = "border-2 border-red-500";

      const { container } = render(<NoResult message={testMessage} className={customClasses} />);

      const rootContainer = container.firstChild as HTMLElement;

      // デフォルトクラスが保持されることを確認
      expect(rootContainer).toHaveClass("flex", "h-full", "w-full", "flex-col", "items-center", "justify-center", "gap-4", "py-8");

      // カスタムクラスが追加されることを確認
      expect(rootContainer).toHaveClass("border-2", "border-red-500");
    });

    it("should handle Tailwind class conflicts through cn function", () => {
      const testMessage = "Tailwind競合テスト";
      const conflictingClasses = "py-4 gap-2"; // py-8, gap-4と競合

      const { container } = render(<NoResult message={testMessage} className={conflictingClasses} />);

      const rootContainer = container.firstChild as HTMLElement;

      // cn関数（twMerge）により最後に指定されたクラスが優先されることを確認
      expect(rootContainer).toHaveClass("py-4", "gap-2");
      expect(rootContainer).not.toHaveClass("py-8", "gap-4");
    });
  });
});
