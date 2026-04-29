import type { TaskRole } from "@/types/auction-types";
import { BidStatus, TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BidStatusBadge, TaskRoleBadge, TaskStatusBadge } from "./status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("BidStatusBadge", () => {
  describe("正常系", () => {
    test("should render BIDDING status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<BidStatusBadge status={BidStatus.BIDDING} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("入札中");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-neutral-900");
    });

    test("should render WON status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<BidStatusBadge status={BidStatus.WON} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("落札");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render LOST status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<BidStatusBadge status={BidStatus.LOST} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("落札失敗");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render INSUFFICIENT status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<BidStatusBadge status={BidStatus.INSUFFICIENT} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("残高不足");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-red-500");
    });
  });

  describe("異常系", () => {
    test("should render fallback for undefined status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      render(<BidStatusBadge status={undefined} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render fallback for invalid status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      render(<BidStatusBadge status="INVALID_STATUS" />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("TaskStatusBadge", () => {
  describe("正常系", () => {
    test("should render PENDING status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.PENDING} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("開始前");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-neutral-900");
    });

    test("should render AUCTION_ACTIVE status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.AUCTION_ACTIVE} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("オークション開催中");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-neutral-900");
    });

    test("should render AUCTION_ENDED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.AUCTION_ENDED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("オークション終了");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render POINTS_DEPOSITED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.POINTS_DEPOSITED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("ポイント預け済み");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-neutral-100");
    });

    test("should render FIXED_EVALUATED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.FIXED_EVALUATED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("評価FIX済み");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render POINTS_AWARDED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.POINTS_AWARDED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("ポイント付与済み");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render ARCHIVED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.ARCHIVED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("アーカイブ");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render AUCTION_CANCELED status correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.AUCTION_CANCELED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("キャンセル");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-red-500");
    });
  });

  describe("特別ケース", () => {
    test("should render 'タスク完了' for SUPPLIER_DONE status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.SUPPLIER_DONE} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("タスク完了");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render 'タスク完了' for TASK_COMPLETED status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.TASK_COMPLETED} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("タスク完了");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });
  });

  describe("境界値テスト・異常系", () => {
    test("should render fallback for undefined status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      render(<TaskStatusBadge status={undefined} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render fallback for invalid status", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      render(<TaskStatusBadge status="INVALID_STATUS" />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should accept optional className prop", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      render(<TaskStatusBadge status={TaskStatus.PENDING} className="custom-class" />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("開始前");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("custom-class");
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("TaskRoleBadge", () => {
  describe("正常系", () => {
    test("should render single role correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["SUPPLIER"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("出品者");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render EXECUTOR role correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["EXECUTOR"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("提供者");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render REPORTER role correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["REPORTER"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("報告者");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render multiple roles correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["SUPPLIER", "EXECUTOR"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("出品者・提供者");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should render all three roles correctly", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["SUPPLIER", "EXECUTOR", "REPORTER"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("出品者・提供者・報告者");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("border-transparent", "bg-green-500");
    });

    test("should handle empty array", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = [];
      const { container } = render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // 空配列の場合、ループが実行されずbadgeLabelは空文字になる
      // 実際の実装では空文字がレンダリングされることを確認
      const badge = container.querySelector('[data-slot="badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe("");
    });
  });

  describe("異常系", () => {
    test("should render fallback for undefined role", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      render(<TaskRoleBadge role={undefined} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });

    test("should render fallback for null role", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // @ts-expect-error: 意図的に無効な値でテスト
      // eslint-disable-next-line jsx-a11y/aria-role
      render(<TaskRoleBadge role={null} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("不明");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-neutral-950");
    });
  });

  describe("境界値テスト", () => {
    test("should handle roles in different order", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["REPORTER", "SUPPLIER", "EXECUTOR"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const badge = screen.getByText("報告者・出品者・提供者");
      expect(badge).toBeInTheDocument();
    });

    test("should handle duplicate roles", () => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      const roles: TaskRole[] = ["SUPPLIER", "SUPPLIER", "EXECUTOR"];
      render(<TaskRoleBadge role={roles} />);
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // 重複があっても配列の順序通りに表示される
      const badge = screen.getByText("出品者・出品者・提供者");
      expect(badge).toBeInTheDocument();
    });
  });
});
