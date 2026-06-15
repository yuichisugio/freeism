import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Loading } from "./share-loading";

describe("Loading", () => {
  describe("正常系", () => {
    test("should render loading component successfully", () => {
      // Act
      render(<Loading />);

      // Assert - コンポーネントが正常にレンダリングされることを確認
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    test("should render Loader2 icon", () => {
      // Act
      render(<Loading />);

      // Assert - Loader2アイコン（SVG要素）がレンダリングされることを確認
      const svgElement = document.querySelector("svg");
      expect(svgElement).toBeInTheDocument();
    });

    test("should display correct loading text", () => {
      // Act
      render(<Loading />);

      // Assert - 正しいローディングテキストが表示されることを確認
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    test("should render container div with correct structure", () => {
      // Act
      render(<Loading />);

      // Assert - コンテナdivが正しい構造でレンダリングされることを確認
      const container = screen.getByText("Loading...").parentElement;
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("flex", "h-dvh", "animate-pulse", "items-center", "justify-center");
    });

    test("should render icon with correct CSS classes", () => {
      // Act
      render(<Loading />);

      // Assert - アイコンが正しいCSSクラスを持つことを確認
      const svgElement = document.querySelector("svg");
      expect(svgElement).toHaveClass("h-8", "w-8", "animate-spin");
    });

    test("should render text with correct CSS classes", () => {
      // Act
      render(<Loading />);

      // Assert - テキストが正しいCSSクラスを持つことを確認
      const textElement = screen.getByText("Loading...");
      expect(textElement).toHaveClass("ml-2", "text-lg");
    });

    test("should have correct component structure", () => {
      // Act
      render(<Loading />);

      // Assert - コンポーネントの構造が正しいことを確認
      const container = screen.getByText("Loading...").parentElement;
      expect(container?.children).toHaveLength(2); // アイコンとテキストの2つの子要素

      // 最初の子要素がSVG（アイコン）
      const firstChild = container?.children[0];
      expect(firstChild?.tagName.toLowerCase()).toBe("svg");

      // 2番目の子要素がspan（テキスト）
      const secondChild = container?.children[1];
      expect(secondChild?.tagName.toLowerCase()).toBe("span");
      expect(secondChild).toHaveTextContent("Loading...");
    });
  });

  describe("アクセシビリティ", () => {
    test("should be accessible for screen readers", () => {
      // Act
      render(<Loading />);

      // Assert - スクリーンリーダーからアクセス可能であることを確認
      const loadingText = screen.getByText("Loading...");
      expect(loadingText).toBeInTheDocument();

      // SVGアイコンが存在することを確認
      const svgElement = document.querySelector("svg");
      expect(svgElement).toBeInTheDocument();
    });

    test("should indicate loading state for assistive technologies", () => {
      // Act
      render(<Loading />);

      // Assert - 支援技術がローディング状態を理解できることを確認
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("スタイリング", () => {
    test("should apply fullscreen height styling", () => {
      // Act
      render(<Loading />);

      // Assert - フルスクリーンの高さスタイルが適用されることを確認
      const container = screen.getByText("Loading...").parentElement;
      expect(container).toHaveClass("h-dvh");
    });

    test("should apply centering styles", () => {
      // Act
      render(<Loading />);

      // Assert - 中央揃えのスタイルが適用されることを確認
      const container = screen.getByText("Loading...").parentElement;
      expect(container).toHaveClass("flex", "items-center", "justify-center");
    });

    test("should apply animation styles", () => {
      // Act
      render(<Loading />);

      // Assert - アニメーションスタイルが適用されることを確認
      const container = screen.getByText("Loading...").parentElement;
      const icon = document.querySelector("svg");

      expect(container).toHaveClass("animate-pulse");
      expect(icon).toHaveClass("animate-spin");
    });
  });

  describe("境界値・異常系", () => {
    test("should handle multiple renders without issues", () => {
      // Act - 複数回レンダリング
      const { rerender } = render(<Loading />);
      rerender(<Loading />);
      rerender(<Loading />);

      // Assert - 問題なくレンダリングされることを確認
      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    test("should maintain component structure consistency", () => {
      // Act
      render(<Loading />);

      // Assert - コンポーネント構造の一貫性を確認
      const loadingElements = screen.getAllByText("Loading...");
      expect(loadingElements).toHaveLength(1); // 重複がないことを確認

      const iconElements = document.querySelectorAll("svg");
      expect(iconElements).toHaveLength(1); // アイコンも重複がないことを確認
    });

    test("should render consistently across multiple instances", () => {
      // Act - 複数のインスタンスをレンダリング
      render(
        <div>
          <Loading />
          <Loading />
        </div>,
      );

      // Assert - 各インスタンスが独立して正しくレンダリングされることを確認
      const loadingTexts = screen.getAllByText("Loading...");
      expect(loadingTexts).toHaveLength(2);

      const icons = document.querySelectorAll("svg");
      expect(icons).toHaveLength(2);
    });
  });

  describe("コンポーネント型", () => {
    test("should return JSX.Element", () => {
      // Act
      const result = Loading();

      // Assert - JSX.Elementを返すことを確認
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    test("should be a function component", () => {
      // Assert - 関数コンポーネントであることを確認
      expect(typeof Loading).toBe("function");
    });
  });
});
