import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AuctionStatus, BidStatus, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションステータスバッジのprops
 */
type AuctionStatusBadgeProps = {
  status: AuctionStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションステータスバッジ
 * @param status オークションステータス
 */
export const AuctionStatusBadge = memo(function AuctionStatusBadge({ status }: AuctionStatusBadgeProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const statusConfig = useMemo(() => {
    return {
      [AuctionStatus.PENDING]: {
        label: "開始前",
        variant: "secondary" as const,
      },
      [AuctionStatus.ACTIVE]: {
        label: "開催中",
        variant: "default" as const,
      },
      [AuctionStatus.ENDED]: {
        label: "終了",
        variant: "outline" as const,
      },
      [AuctionStatus.CANCELED]: {
        label: "キャンセル",
        variant: "destructive" as const,
      },
    };
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const config = useMemo(() => statusConfig[status], [status, statusConfig]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <Badge variant={config.variant}>{config.label}</Badge>;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札ステータスバッジのprops
 */
type BidStatusBadgeProps = {
  status: BidStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札ステータスバッジ
 * @param status 入札ステータス
 */
export const BidStatusBadge = memo(function BidStatusBadge({ status }: BidStatusBadgeProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const statusConfig = useMemo(() => {
    return {
      [BidStatus.BIDDING]: {
        label: "入札中",
        variant: "default" as const,
      },
      [BidStatus.WON]: {
        label: "落札",
        variant: "success" as const,
      },
      [BidStatus.LOST]: {
        label: "落札失敗",
        variant: "outline" as const,
      },
      [BidStatus.INSUFFICIENT]: {
        label: "残高不足",
        variant: "destructive" as const,
      },
    };
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const config = useMemo(() => statusConfig[status], [status, statusConfig]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <Badge variant={config.variant}>{config.label}</Badge>;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスバッジのprops
 */
type TaskStatusBadgeProps = {
  status: TaskStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスバッジ
 * @param status タスクステータス
 */
export const TaskStatusBadge = memo(function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const statusConfig = useMemo(() => {
    return {
      [TaskStatus.PENDING]: {
        label: "進行中",
        variant: "default" as const,
      },
      [TaskStatus.POINTS_DEPOSITED]: {
        label: "ポイント預け済み",
        variant: "secondary" as const,
      },
      [TaskStatus.TASK_COMPLETED]: {
        label: "タスク完了",
        variant: "success" as const,
      },
      [TaskStatus.FIXED_EVALUATED]: {
        label: "評価済み",
        variant: "success" as const,
      },
      [TaskStatus.POINTS_AWARDED]: {
        label: "ポイント付与済み",
        variant: "success" as const,
      },
      [TaskStatus.ARCHIVED]: {
        label: "アーカイブ",
        variant: "outline" as const,
      },
    };
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const config = useMemo(() => statusConfig[status], [status, statusConfig]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return <Badge variant={config.variant}>{config.label}</Badge>;
});
