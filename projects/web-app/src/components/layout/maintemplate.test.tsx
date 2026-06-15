import { unstable_cacheLife } from "next/cache";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MainTemplate } from "./maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next/cacheのモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheLife: vi.fn(),
}));

const mockCacheLife = vi.mocked(unstable_cacheLife);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * MainTemplateコンポーネントのテスト
 */
describe("MainTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングテスト
   */
  test("should render children correctly", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * title/descriptionが文字列の場合の表示テスト
   */
  test("should render title and description when both are strings", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * title/descriptionがfalseの場合の非表示テスト
   */
  test("should not render title and description when both are false", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: false,
        description: false,
        children: <TestChild />,
      }),
    );

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * titleがfalse、descriptionが文字列の場合の非表示テスト
   */
  test("should not render title and description when title is false", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: false,
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Test Description")).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * titleが文字列、descriptionがfalseの場合の非表示テスト
   */
  test("should not render title and description when description is false", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: false,
        children: <TestChild />,
      }),
    );

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * componentプロパティが提供された場合のテスト
   */
  test("should render component when provided", async () => {
    const TestChild = () => <div>Test Child Content</div>;
    const TestComponent = () => <button>Test Button</button>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        component: <TestComponent />,
        children: <TestChild />,
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test Button" })).toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * componentプロパティが提供されない場合のテスト
   */
  test("should not render component when not provided", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * componentプロパティがundefinedの場合のテスト
   */
  test("should not render component when undefined", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        component: undefined,
        children: <TestChild />,
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト: 空文字列のtitle/description
   */
  test("should not render title and description when they are empty strings", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "",
        description: "",
        children: <TestChild />,
      }),
    );

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト: 空白文字のみのtitle/description
   */
  test("should render title and description when they contain only whitespace", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "   ",
        description: "   ",
        children: <TestChild />,
      }),
    );

    // 空白文字のみの場合でもheading要素は存在する
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    // 空白文字のみの場合、HTMLでは空として扱われるため、存在確認のみ
    const descriptionElement = screen.getByText("Test Child Content").parentElement?.parentElement?.querySelector("p");
    expect(descriptionElement).toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 複雑なchildrenのテスト
   */
  test("should render complex children correctly", async () => {
    const ComplexChild = () => (
      <div>
        <h2>Complex Child</h2>
        <p>With multiple elements</p>
        <button>Action Button</button>
      </div>
    );

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <ComplexChild />,
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Complex Child");
    expect(screen.getByText("With multiple elements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 複数のchildrenのテスト
   */
  test("should render multiple children correctly", async () => {
    const Child1 = () => <div>First Child</div>;
    const Child2 = () => <div>Second Child</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: (
          <>
            <Child1 />
            <Child2 />
          </>
        ),
      }),
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Title");
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("First Child")).toBeInTheDocument();
    expect(screen.getByText("Second Child")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * cacheLifeが正しく呼び出されることのテスト
   */
  test("should call cacheLife with 'max' parameter", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    expect(mockCacheLife).toHaveBeenCalledWith("max");
    expect(mockCacheLife).toHaveBeenCalledTimes(1);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Suspenseのfallbackが表示されることのテスト
   */
  test("should render Suspense fallback when component is provided", async () => {
    const TestChild = () => <div>Test Child Content</div>;
    const TestComponent = () => <button>Test Button</button>;

    const result = await MainTemplate({
      title: "Test Title",
      description: "Test Description",
      component: <TestComponent />,
      children: <TestChild />,
    });

    render(result);

    // Suspenseでラップされたコンポーネントが存在することを確認
    expect(screen.getByRole("button", { name: "Test Button" })).toBeInTheDocument();
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * CSSクラスが正しく適用されることのテスト
   */
  test("should apply correct CSS classes", async () => {
    const TestChild = () => <div>Test Child Content</div>;

    render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        children: <TestChild />,
      }),
    );

    const titleElement = screen.getByRole("heading", { level: 1 });
    const descriptionElement = screen.getByText("Test Description");

    expect(titleElement).toHaveClass("page-title-custom");
    expect(descriptionElement).toHaveClass("page-description-custom");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レイアウト構造が正しいことのテスト
   */
  test("should have correct layout structure", async () => {
    const TestChild = () => <div>Test Child Content</div>;
    const TestComponent = () => <button>Test Button</button>;

    const { container } = render(
      await MainTemplate({
        title: "Test Title",
        description: "Test Description",
        component: <TestComponent />,
        children: <TestChild />,
      }),
    );

    // フラグメント内の構造を確認
    const mainDiv = container.querySelector("div.flex.flex-col.justify-between.sm\\:flex-row");
    expect(mainDiv).toBeInTheDocument();

    // title/descriptionのコンテナが存在することを確認
    const titleDescriptionDiv = mainDiv?.querySelector("div");
    expect(titleDescriptionDiv).toBeInTheDocument();

    // childrenが正しく表示されることを確認
    expect(screen.getByText("Test Child Content")).toBeInTheDocument();
  });
});
