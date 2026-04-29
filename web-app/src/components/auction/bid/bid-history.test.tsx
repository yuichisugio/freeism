import type { AuctionWithDetails } from "@/types/auction-types";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BidHistory } from "./bid-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Framer Motionのモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
  },
}));

// ユーティリティ関数のモック
vi.mock("@/lib/utils", () => ({
  formatCurrency: vi.fn((amount: number) => `¥${amount.toLocaleString()}`),
  formatRelativeTime: vi.fn(() => "2時間前"),
  cn: vi.fn((...classes) => classes.filter(Boolean).join(" ")),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータファクトリー
type BidHistoryItem = AuctionWithDetails["bidHistories"][0];

const bidHistoryItemFactory = Factory.define<BidHistoryItem>(({ sequence, params }) => ({
  id: params.id ?? `bid-${sequence}`,
  amount: params.amount ?? 1000,
  createdAt: params.createdAt ?? new Date("2024-01-01T10:00:00Z"),
  isAutoBid: params.isAutoBid ?? false,
  user: {
    settings: {
      username: params.user?.settings?.username ?? `ユーザー${sequence}`,
    },
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("BidHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("基本表示", () => {
    test("should render empty state when no bids provided", () => {
      // Arrange & Act
      render(<BidHistory initialBids={[]} />);

      // Assert
      expect(screen.getByText("まだ入札がありません")).toBeInTheDocument();
    });

    test("should render bid history when bids are provided", () => {
      // Arrange
      const bidHistory = bidHistoryItemFactory.build({
        amount: 1500,
        user: {
          settings: {
            username: "テストユーザー",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[bidHistory]} />);

      // Assert
      expect(screen.getByText("入札アクティビティ")).toBeInTheDocument();
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
      expect(screen.getByText("¥1,500")).toBeInTheDocument();
    });
  });

  describe("入札方法の表示", () => {
    test("should display manual bid badge for manual bids", () => {
      // Arrange
      const manualBid = bidHistoryItemFactory.build({
        isAutoBid: false,
        user: {
          settings: {
            username: "手動入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[manualBid]} />);

      // Assert
      expect(screen.getByText("手動入札")).toBeInTheDocument();
    });

    test("should display auto bid badge for auto bids", () => {
      // Arrange
      const autoBid = bidHistoryItemFactory.build({
        isAutoBid: true,
        user: {
          settings: {
            username: "自動入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[autoBid]} />);

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
    });
  });

  describe("最高額入札者のバッジ表示", () => {
    test("should display highest bidder badge for first bid", () => {
      // Arrange
      const bids = [
        bidHistoryItemFactory.build({
          amount: 2000,
          user: {
            settings: {
              username: "最高額入札者",
            },
          },
        }),
        bidHistoryItemFactory.build({
          amount: 1500,
          user: {
            settings: {
              username: "2番目の入札者",
            },
          },
        }),
      ];

      // Act
      render(<BidHistory initialBids={bids} />);

      // Assert
      expect(screen.getByText("現在の最高額")).toBeInTheDocument();
    });

    test("should not display highest bidder badge for non-first bids", () => {
      // Arrange
      const bids = [
        bidHistoryItemFactory.build({
          amount: 2000,
          user: {
            settings: {
              username: "最高額入札者",
            },
          },
        }),
        bidHistoryItemFactory.build({
          amount: 1500,
          user: {
            settings: {
              username: "2番目の入札者",
            },
          },
        }),
      ];

      // Act
      render(<BidHistory initialBids={bids} />);

      // Assert
      const highestBadges = screen.getAllByText("現在の最高額");
      expect(highestBadges).toHaveLength(1); // Only one highest bidder badge should exist
    });
  });

  describe("ユーザー名の表示", () => {
    test("should display username when user settings exist", () => {
      // Arrange
      const bid = bidHistoryItemFactory.build({
        user: {
          settings: {
            username: "有効なユーザー",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[bid]} />);

      // Assert
      expect(screen.getByText("有効なユーザー")).toBeInTheDocument();
    });

    test("should display fallback username when user settings is null", () => {
      // Arrange
      const bid = bidHistoryItemFactory.build({
        user: {
          settings: null,
        },
      });

      // Act
      render(<BidHistory initialBids={[bid]} />);

      // Assert
      expect(screen.getByText("不明なユーザー")).toBeInTheDocument();
    });

    test("should display fallback username when username is null", () => {
      // Arrange
      const bid = {
        id: "bid-1",
        amount: 1000,
        createdAt: new Date("2024-01-01T10:00:00Z"),
        isAutoBid: false,
        user: {
          settings: null,
        },
      };

      // Act
      render(<BidHistory initialBids={[bid]} />);

      // Assert
      expect(screen.getByText("不明なユーザー")).toBeInTheDocument();
    });
  });

  describe("境界値テスト", () => {
    test("should handle single bid correctly", () => {
      // Arrange
      const singleBid = bidHistoryItemFactory.build({
        amount: 1,
        user: {
          settings: {
            username: "単独入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[singleBid]} />);

      // Assert
      expect(screen.getByText("単独入札者")).toBeInTheDocument();
      expect(screen.getByText("¥1")).toBeInTheDocument();
      expect(screen.getByText("現在の最高額")).toBeInTheDocument();
    });

    test("should handle large bid amounts correctly", () => {
      // Arrange
      const largeBid = bidHistoryItemFactory.build({
        amount: 9999999,
        user: {
          settings: {
            username: "高額入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[largeBid]} />);

      // Assert
      expect(screen.getByText("¥9,999,999")).toBeInTheDocument();
    });

    test("should handle many bids correctly", () => {
      // Arrange
      const manyBids = Array.from({ length: 10 }, (_, index) =>
        bidHistoryItemFactory.build({
          amount: 1000 + index * 100,
          user: {
            settings: {
              username: `入札者${index + 1}`,
            },
          },
        }),
      );

      // Act
      render(<BidHistory initialBids={manyBids} />);

      // Assert
      expect(screen.getByText("入札者1")).toBeInTheDocument();
      expect(screen.getByText("入札者10")).toBeInTheDocument();
      // Only one "現在の最高額" badge should exist
      const highestBadges = screen.getAllByText("現在の最高額");
      expect(highestBadges).toHaveLength(1);
    });
  });

  describe("異常系・エラーケース", () => {
    test("should handle undefined initialBids gracefully", () => {
      // Arrange & Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      render(<BidHistory initialBids={undefined as any} />);

      // Assert
      expect(screen.getByText("まだ入札がありません")).toBeInTheDocument();
    });

    test("should handle null user settings gracefully", () => {
      // Arrange
      const bidWithNullUser = {
        id: "bid-1",
        amount: 1000,
        createdAt: new Date("2024-01-01T10:00:00Z"),
        isAutoBid: false,
        user: {
          settings: null,
        },
      };

      // Act
      render(<BidHistory initialBids={[bidWithNullUser]} />);

      // Assert
      expect(screen.getByText("不明なユーザー")).toBeInTheDocument();
    });

    test("should handle zero amount bid", () => {
      // Arrange
      const zeroBid = bidHistoryItemFactory.build({
        amount: 0,
        user: {
          settings: {
            username: "0円入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[zeroBid]} />);

      // Assert
      expect(screen.getByText("¥0")).toBeInTheDocument();
    });

    test("should handle negative amount bid", () => {
      // Arrange
      const negativeBid = bidHistoryItemFactory.build({
        amount: -100,
        user: {
          settings: {
            username: "負の額入札者",
          },
        },
      });

      // Act
      render(<BidHistory initialBids={[negativeBid]} />);

      // Assert
      expect(screen.getByText("¥-100")).toBeInTheDocument();
    });
  });
});
