import { Badge } from "@/components/ui/badge";
import { AuctionStatus, BidStatus, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type AuctionStatusBadgeProps = {
  status: AuctionStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションステータスバッジ
 * @param status オークションステータス
 */
export function AuctionStatusBadge({ status }: AuctionStatusBadgeProps) {
  const statusConfig = {
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

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type BidStatusBadgeProps = {
  status: BidStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札ステータスバッジ
 * @param status 入札ステータス
 */
export function BidStatusBadge({ status }: BidStatusBadgeProps) {
  const statusConfig = {
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

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type TaskStatusBadgeProps = {
  status: TaskStatus;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスバッジ
 * @param status タスクステータス
 */
export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const statusConfig = {
    [TaskStatus.PENDING]: {
      label: "進行中",
      variant: "default" as const,
    },
    [TaskStatus.BIDDED]: {
      label: "落札済み",
      variant: "secondary" as const,
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

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
