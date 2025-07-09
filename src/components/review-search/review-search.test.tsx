import type { ReviewData, ReviewSearchParams, SearchSuggestion } from "@/components/review-search/review-search";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ReviewCard } from "./review-search-card";
import { ReviewSearchForm } from "./review-search-form";
import { ReviewPagination } from "./review-search-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseReviewSearch, mockUseReviewSuggest } = vi.hoisted(() => ({
  mockUseReviewSearch: vi.fn(),
  mockUseReviewSuggest: vi.fn(),
}));

// useReviewSearchフックのモック
vi.mock("@/hooks/review-search/use-review-search", () => ({
  useReviewSearch: mockUseReviewSearch,
}));

// useReviewSuggestフックのモック
vi.mock("@/hooks/review-search/use-review-suggest", () => ({
  useReviewSuggest: mockUseReviewSuggest,
}));

// RatingStarコンポーネントのモック
vi.mock("@/components/auction/common/rating-star", () => ({
  RatingStar: vi.fn(
    ({
      rating,
      readonly,
      onChange,
      size,
    }: {
      rating?: number;
      readonly?: boolean;
      onChange?: (rating: number) => void;
      size?: number;
    }) => (
      <div data-testid="rating-star" data-rating={rating} data-readonly={readonly} data-size={size}>
        {readonly ? (
          <span>Rating: {rating}</span>
        ) : (
          <button onClick={() => onChange?.(rating ? rating + 1 : 1)}>Change Rating</button>
        )}
      </div>
    ),
  ),
}));

// Errorコンポーネントのモック
vi.mock("@/components/share/share-error", () => ({
  Error: vi.fn(({ error, previousPageURL }: { error: string; previousPageURL: string }) => (
    <div data-testid="error-component" data-error={error} data-previous-url={previousPageURL}>
      Error: {error}
    </div>
  )),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const mockSuggestions: SearchSuggestion[] = [
  { value: "user1", label: "ユーザー1" },
  { value: "task1", label: "タスク1" },
  { value: "group1", label: "グループ1" },
];

const mockSearchParams: ReviewSearchParams = {
  searchQuery: "",
  page: 1,
  tab: "search",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ReviewPaginationコンポーネントのテスト
 */
describe("ReviewPagination", () => {
  const mockOnPageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本表示", () => {
    test("should render pagination with correct page numbers", () => {
      render(<ReviewPagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      // ページ番号ボタンが表示されることを確認
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();

      // 前へ・次へボタンが表示されることを確認
      expect(screen.getByText("前へ")).toBeInTheDocument();
      expect(screen.getByText("次へ")).toBeInTheDocument();
    });

    test("should highlight current page", () => {
      render(<ReviewPagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const currentPageButton = screen.getByText("3");
      expect(currentPageButton).toHaveClass("bg-blue-600");
    });

    test("should disable previous button on first page", () => {
      render(<ReviewPagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const prevButton = screen.getByText("前へ");
      expect(prevButton).toBeDisabled();
    });

    test("should disable next button on last page", () => {
      render(<ReviewPagination currentPage={5} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const nextButton = screen.getByText("次へ");
      expect(nextButton).toBeDisabled();
    });

    test("should render skeleton UI when not mounted", () => {
      const { container } = render(
        <ReviewPagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} isMounted={false} />,
      );

      // スケルトンUIが表示されることを確認
      const skeletonElements = container.querySelectorAll("div.bg-gray-200");
      expect(skeletonElements.length).toBeGreaterThan(0);

      // 実際のページネーションボタンが表示されないことを確認
      expect(screen.queryByText("前へ")).not.toBeInTheDocument();
      expect(screen.queryByText("次へ")).not.toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ページ変更機能", () => {
    test("should call onPageChange when page number is clicked", () => {
      render(<ReviewPagination currentPage={2} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const pageButton = screen.getByText("4");
      fireEvent.click(pageButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(4);
      expect(mockOnPageChange).toHaveBeenCalledTimes(1);
    });

    test("should call onPageChange when previous button is clicked", () => {
      render(<ReviewPagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const prevButton = screen.getByText("前へ");
      fireEvent.click(prevButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    test("should call onPageChange when next button is clicked", () => {
      render(<ReviewPagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} isMounted={true} />);

      const nextButton = screen.getByText("次へ");
      fireEvent.click(nextButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(4);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("省略記号の表示", () => {
    test("should show ellipsis when there are many pages", () => {
      const { container } = render(
        <ReviewPagination currentPage={5} totalPages={15} onPageChange={mockOnPageChange} isMounted={true} />,
      );

      // 省略記号（MoreHorizontal）が表示されることを確認
      // MoreHorizontalアイコンはspanタグ内に表示される
      const ellipsisSpans = container.querySelectorAll("span.flex.items-center.px-2.text-gray-500");
      expect(ellipsisSpans.length).toBeGreaterThan(0);
    });

    test("should show first and last page when in middle", () => {
      render(<ReviewPagination currentPage={8} totalPages={15} onPageChange={mockOnPageChange} isMounted={true} />);

      // 最初と最後のページが表示されることを確認
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle single page correctly", () => {
      render(<ReviewPagination currentPage={1} totalPages={1} onPageChange={mockOnPageChange} isMounted={true} />);

      // 前へ・次へボタンが無効化されることを確認
      expect(screen.getByText("前へ")).toBeDisabled();
      expect(screen.getByText("次へ")).toBeDisabled();

      // ページ番号1のみが表示されることを確認
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    test("should handle zero pages gracefully", () => {
      render(<ReviewPagination currentPage={1} totalPages={0} onPageChange={mockOnPageChange} isMounted={true} />);

      // 前へ・次へボタンが無効化されることを確認
      expect(screen.getByText("前へ")).toBeDisabled();
      expect(screen.getByText("次へ")).toBeDisabled();
    });

    test("should handle large number of pages", () => {
      render(<ReviewPagination currentPage={50} totalPages={100} onPageChange={mockOnPageChange} isMounted={true} />);

      // 現在のページが表示されることを確認
      expect(screen.getByText("50")).toBeInTheDocument();
      // 最初と最後のページが表示されることを確認
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ReviewSearchFormコンポーネントのテスト
 */
describe("ReviewSearchForm", () => {
  const mockProps = {
    searchParams: mockSearchParams,
    suggestionQuery: "",
    suggestions: [],
    showSuggestions: false,
    onSearchQueryChange: vi.fn(),
    onSuggestionSelect: vi.fn(),
    onSuggestionsToggle: vi.fn(),
    onSearchExecute: vi.fn(),
    onClearSearch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // useReviewSuggestフックのモック設定
    mockUseReviewSuggest.mockReturnValue({
      inputRef: { current: null },
      suggestionRef: { current: null },
      selectedIndex: -1,
      handleKeyDown: vi.fn(),
      handleSubmit: vi.fn(),
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本表示", () => {
    test("should render search form with input field", () => {
      render(<ReviewSearchForm {...mockProps} />);

      // 検索入力フィールドが表示されることを確認
      const searchInput = screen.getByPlaceholderText(
        "検索キーワードを入力してください（ユーザー名、コメント、グループ名、タスク名等）",
      );
      expect(searchInput).toBeInTheDocument();

      // 検索ボタンが表示されることを確認
      const searchButton = screen.getByRole("button", { name: /検索/i });
      expect(searchButton).toBeInTheDocument();

      // クリアボタンは検索クエリがない場合は表示されない
      const clearButton = screen.queryByRole("button", { name: /×/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    test("should display suggestion query in input field", () => {
      render(<ReviewSearchForm {...mockProps} suggestionQuery="test query" />);

      const searchInput = screen.getByDisplayValue("test query");
      expect(searchInput).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("検索機能", () => {
    test("should call onSearchQueryChange when input value changes", () => {
      render(<ReviewSearchForm {...mockProps} />);

      const searchInput = screen.getByPlaceholderText(
        "検索キーワードを入力してください（ユーザー名、コメント、グループ名、タスク名等）",
      );
      fireEvent.change(searchInput, { target: { value: "new query" } });

      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith("new query");
    });

    test("should call onSearchExecute when search button is clicked", () => {
      const mockHandleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      mockUseReviewSuggest.mockReturnValue({
        inputRef: { current: null },
        suggestionRef: { current: null },
        selectedIndex: -1,
        handleKeyDown: vi.fn(),
        handleSubmit: mockHandleSubmit,
      });

      render(<ReviewSearchForm {...mockProps} />);

      const searchButton = screen.getByRole("button", { name: /検索/i });
      fireEvent.click(searchButton);

      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
    });

    test("should call onClearSearch when clear button is clicked", () => {
      // クリアボタンが表示されるように検索クエリを設定
      render(<ReviewSearchForm {...mockProps} suggestionQuery="test query" />);

      // クリアボタンをXアイコンで特定
      const clearButton = screen.getByRole("button", { name: "" });
      fireEvent.click(clearButton);

      expect(mockProps.onClearSearch).toHaveBeenCalledTimes(1);
    });

    test("should show clear button when suggestion query is not empty", () => {
      render(<ReviewSearchForm {...mockProps} suggestionQuery="test query" />);

      // クリアボタンが存在することを確認（Xアイコンを含むボタン）
      const buttons = screen.getAllByRole("button");
      const clearButton = buttons.find(
        (button) => (button as HTMLButtonElement).type === "button" && button.textContent === "",
      );
      expect(clearButton).toBeInTheDocument();
    });

    test("should not show clear button when suggestion query is empty", () => {
      render(<ReviewSearchForm {...mockProps} suggestionQuery="" />);

      // 検索ボタンのみが存在し、クリアボタンは存在しないことを確認
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1); // 検索ボタンのみ
      expect(buttons[0]).toHaveTextContent("検索");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("サジェスト機能", () => {
    test("should display suggestions when showSuggestions is true", () => {
      render(<ReviewSearchForm {...mockProps} suggestions={mockSuggestions} showSuggestions={true} />);

      // サジェストが表示されることを確認
      expect(screen.getByText("ユーザー1")).toBeInTheDocument();
      expect(screen.getByText("タスク1")).toBeInTheDocument();
      expect(screen.getByText("グループ1")).toBeInTheDocument();
    });

    test("should not display suggestions when showSuggestions is false", () => {
      render(<ReviewSearchForm {...mockProps} suggestions={mockSuggestions} showSuggestions={false} />);

      // サジェストが表示されないことを確認
      expect(screen.queryByText("ユーザー1")).not.toBeInTheDocument();
      expect(screen.queryByText("タスク1")).not.toBeInTheDocument();
      expect(screen.queryByText("グループ1")).not.toBeInTheDocument();
    });

    test("should call onSuggestionSelect when suggestion is clicked", () => {
      render(<ReviewSearchForm {...mockProps} suggestions={mockSuggestions} showSuggestions={true} />);

      const suggestionButton = screen.getByText("ユーザー1");
      fireEvent.click(suggestionButton);

      expect(mockProps.onSuggestionSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    test("should not display suggestions when suggestions array is empty", () => {
      render(<ReviewSearchForm {...mockProps} suggestions={[]} showSuggestions={true} />);

      // サジェストコンテナが表示されないことを確認
      const suggestionContainer = document.querySelector(".absolute.top-full");
      expect(suggestionContainer).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードナビゲーション", () => {
    test("should call useReviewSuggest hook with correct props", () => {
      render(<ReviewSearchForm {...mockProps} suggestions={mockSuggestions} />);

      expect(mockUseReviewSuggest).toHaveBeenCalledWith({
        onSuggestionsToggleAction: mockProps.onSuggestionsToggle,
        suggestions: mockSuggestions,
        onSuggestionSelectAction: mockProps.onSuggestionSelect,
        onSearchExecuteAction: mockProps.onSearchExecute,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty suggestion query", () => {
      render(<ReviewSearchForm {...mockProps} suggestionQuery="" />);

      const searchInput = screen.getByPlaceholderText(
        "検索キーワードを入力してください（ユーザー名、コメント、グループ名、タスク名等）",
      );
      expect(searchInput).toHaveValue("");
    });

    test("should handle very long suggestion query", () => {
      const longQuery = "a".repeat(1000);
      render(<ReviewSearchForm {...mockProps} suggestionQuery={longQuery} />);

      const searchInput = screen.getByDisplayValue(longQuery);
      expect(searchInput).toBeInTheDocument();
    });

    test("should handle large number of suggestions", () => {
      const manySuggestions = Array.from({ length: 100 }, (_, i) => ({
        value: `item${i}`,
        label: `アイテム${i}`,
      }));

      render(<ReviewSearchForm {...mockProps} suggestions={manySuggestions} showSuggestions={true} />);

      // 最初と最後のサジェストが表示されることを確認
      expect(screen.getByText("アイテム0")).toBeInTheDocument();
      expect(screen.getByText("アイテム99")).toBeInTheDocument();
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ReviewCardコンポーネントのテスト
 */
describe("ReviewCard", () => {
  const mockReviewData: ReviewData = {
    id: "review-1",
    rating: 4,
    comment: "とても良いサービスでした。また利用したいと思います。",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
    reviewPosition: "BUYER_TO_SELLER",
    reviewer: {
      id: "user-1",
      username: "テストユーザー1",
    },
    reviewee: {
      id: "user-2",
      username: "テストユーザー2",
    },
    auction: {
      id: "auction-1",
      task: {
        id: "task-1",
        task: "Webサイトのデザインを作成してください。レスポンシブ対応で、モダンなUIを希望します。",
        category: "デザイン",
        group: {
          id: "group-1",
          name: "テストグループ",
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本表示", () => {
    test("should render review card with all basic information", () => {
      render(<ReviewCard review={mockReviewData} />);

      // 評価が表示されることを確認
      expect(screen.getByText("4.0")).toBeInTheDocument();

      // レビューポジションバッジが表示されることを確認
      expect(screen.getByText("買い手から")).toBeInTheDocument();

      // 日付が表示されることを確認
      expect(screen.getByText("2024/1/15")).toBeInTheDocument();

      // 宛先ユーザーが表示されることを確認
      expect(screen.getByText("宛先: テストユーザー2")).toBeInTheDocument();

      // コメントが表示されることを確認
      expect(screen.getByText("とても良いサービスでした。また利用したいと思います。")).toBeInTheDocument();

      // タスク情報が表示されることを確認
      expect(
        screen.getByText(/タスク: Webサイトのデザインを作成してください。レスポンシブ対応で、モダンなUIを希望します。/),
      ).toBeInTheDocument();

      // グループ情報が表示されることを確認
      expect(screen.getByText("グループ: テストグループ")).toBeInTheDocument();

      // カテゴリ情報が表示されることを確認
      expect(screen.getByText("カテゴリ: デザイン")).toBeInTheDocument();
    });

    test("should render correct number of filled stars", () => {
      render(<ReviewCard review={mockReviewData} />);

      // 星評価の表示を確認（評価数値で確認）
      expect(screen.getByText("4.0")).toBeInTheDocument();

      // 星評価のコンテナが存在することを確認
      const starContainer = document.querySelector(".flex.items-center");
      expect(starContainer).toBeInTheDocument();
    });

    test("should show reviewer when showReviewer is true", () => {
      render(<ReviewCard review={mockReviewData} showReviewer={true} />);

      expect(screen.getByText("送信者: テストユーザー1")).toBeInTheDocument();
    });

    test("should not show reviewer when showReviewer is false", () => {
      render(<ReviewCard review={mockReviewData} showReviewer={false} />);

      expect(screen.queryByText("送信者: テストユーザー1")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("条件付き表示", () => {
    test("should not render comment section when comment is null", () => {
      const reviewWithoutComment = { ...mockReviewData, comment: null };
      render(<ReviewCard review={reviewWithoutComment} />);

      expect(screen.queryByText("とても良いサービスでした。また利用したいと思います。")).not.toBeInTheDocument();
    });

    test("should not render category when category is null", () => {
      const reviewWithoutCategory = {
        ...mockReviewData,
        auction: {
          ...mockReviewData.auction,
          task: {
            ...mockReviewData.auction.task,
            category: null,
          },
        },
      };
      render(<ReviewCard review={reviewWithoutCategory} />);

      expect(screen.queryByText(/カテゴリ:/)).not.toBeInTheDocument();
    });

    test("should show updated date when review is updated", () => {
      const updatedReview = {
        ...mockReviewData,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      };
      render(<ReviewCard review={updatedReview} />);

      expect(screen.getByText(/更新: 2024\/1\/16/)).toBeInTheDocument();
    });

    test("should show correct position badge for SELLER_TO_BUYER", () => {
      const sellerReview = { ...mockReviewData, reviewPosition: "SELLER_TO_BUYER" as const };
      render(<ReviewCard review={sellerReview} />);

      expect(screen.getByText("売り手から")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle minimum rating (1)", () => {
      const minRatingReview = { ...mockReviewData, rating: 1 };
      render(<ReviewCard review={minRatingReview} />);

      expect(screen.getByText("1.0")).toBeInTheDocument();
    });

    test("should handle maximum rating (5)", () => {
      const maxRatingReview = { ...mockReviewData, rating: 5 };
      render(<ReviewCard review={maxRatingReview} />);

      expect(screen.getByText("5.0")).toBeInTheDocument();
    });

    test("should handle very long task name", () => {
      const longTaskReview = {
        ...mockReviewData,
        auction: {
          ...mockReviewData.auction,
          task: {
            ...mockReviewData.auction.task,
            task: "a".repeat(100),
          },
        },
      };
      render(<ReviewCard review={longTaskReview} />);

      // 50文字で切り詰められることを確認
      expect(screen.getByText(/タスク: a{50}\.\.\./)).toBeInTheDocument();
    });

    test("should handle null reviewee", () => {
      const reviewWithoutReviewee = { ...mockReviewData, reviewee: null };
      render(<ReviewCard review={reviewWithoutReviewee} />);

      expect(screen.queryByText(/宛先:/)).not.toBeInTheDocument();
    });

    test("should handle null reviewer", () => {
      const reviewWithoutReviewer = { ...mockReviewData, reviewer: null };
      render(<ReviewCard review={reviewWithoutReviewer} showReviewer={true} />);

      expect(screen.queryByText(/送信者:/)).not.toBeInTheDocument();
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ReviewCard (editable)コンポーネントのテスト
 */
describe("ReviewCard (editable)", () => {
  const mockEditableReviewData = {
    id: "review-1",
    rating: 4,
    comment: "とても良いサービスでした。また利用したいと思います。",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
    reviewPosition: "BUYER_TO_SELLER" as const,
    reviewer: {
      id: "user-1",
      username: "テストユーザー1",
    },
    reviewee: {
      id: "user-2",
      username: "テストユーザー2",
    },
    auction: {
      id: "auction-1",
      task: {
        id: "task-1",
        task: "Webサイトのデザインを作成してください。レスポンシブ対応で、モダンなUIを希望します。",
        category: "デザイン",
        group: {
          id: "group-1",
          name: "テストグループ",
        },
      },
    },
    isEditing: false,
  };

  const mockProps = {
    review: mockEditableReviewData,
    editable: true,
    onToggleEdit: vi.fn(),
    onUpdateReview: vi.fn(),
    isUpdating: false,
    isMounted: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本表示", () => {
    test("should render editable review card in view mode", () => {
      render(<ReviewCard {...mockProps} />);

      // 評価が表示されることを確認
      expect(screen.getByText("4.0")).toBeInTheDocument();

      // 編集ボタンが表示されることを確認
      const editButton = screen.getByRole("button");
      expect(editButton).toBeInTheDocument();

      // コメントが表示されることを確認
      expect(screen.getByText("とても良いサービスでした。また利用したいと思います。")).toBeInTheDocument();
    });

    test("should render editable review card in edit mode", () => {
      const editingReview = { ...mockEditableReviewData, isEditing: true };
      render(<ReviewCard {...mockProps} review={editingReview} />);

      // 保存ボタンとキャンセルボタンが表示されることを確認（RatingStarのボタンも含まれる）
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2); // 保存とキャンセル（+RatingStarのボタン）

      // テキストエリアが表示されることを確認
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue("とても良いサービスでした。また利用したいと思います。");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("編集機能", () => {
    test("should call onToggleEdit when edit button is clicked", () => {
      render(<ReviewCard {...mockProps} />);

      const editButton = screen.getByRole("button");
      fireEvent.click(editButton);

      expect(mockProps.onToggleEdit).toHaveBeenCalledWith(mockEditableReviewData.id);
      expect(mockProps.onToggleEdit).toHaveBeenCalledTimes(1);
    });

    test("should update comment when textarea value changes", () => {
      const editingReview = { ...mockEditableReviewData, isEditing: true };
      render(<ReviewCard {...mockProps} review={editingReview} />);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "新しいコメント" } });

      expect(textarea).toHaveValue("新しいコメント");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("更新状態", () => {
    test("should show updated date when review is updated", () => {
      const updatedReview = {
        ...mockEditableReviewData,
        updatedAt: new Date("2024-01-16T10:00:00Z"),
      };
      render(<ReviewCard {...mockProps} review={updatedReview} />);

      expect(screen.getByText(/更新: 2024\/1\/16/)).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty comment", () => {
      const reviewWithoutComment = { ...mockEditableReviewData, comment: null, isEditing: true };
      render(<ReviewCard {...mockProps} review={reviewWithoutComment} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("");
    });
  });
});
