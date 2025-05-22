import { Badge } from "@/components/ui/badge";
import { BidStatus, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// TaskStatusをオークション用バッジとして利用
const auctionTaskStatusConfig: Record<string, { label: string; variant: "secondary" | "default" | "outline" }> = {
  [TaskStatus.PENDING]: {
    label: "開始前",
    variant: "secondary",
  },
  [TaskStatus.AUCTION_ACTIVE]: {
    label: "開催中",
    variant: "default",
  },
  [TaskStatus.AUCTION_ENDED]: {
    label: "終了",
    variant: "outline",
  },
  [TaskStatus.POINTS_DEPOSITED]: { label: "ポイント預け済み", variant: "outline" },
  [TaskStatus.SUPPLIER_DONE]: { label: "提供の完了", variant: "outline" },
  [TaskStatus.TASK_COMPLETED]: { label: "タスク完了", variant: "outline" },
  [TaskStatus.FIXED_EVALUATED]: { label: "評価済み", variant: "outline" },
  [TaskStatus.POINTS_AWARDED]: { label: "ポイント付与済み", variant: "outline" },
  [TaskStatus.ARCHIVED]: { label: "アーカイブ", variant: "outline" },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション用タスクステータスバッジ
 * @param status タスク（オークション）ステータス
 */
export function AuctionStatusBadge({ status }: { status: TaskStatus }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const config = auctionTaskStatusConfig[status as string];
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  if (!config) {
    return <Badge variant="outline">不明</Badge>;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const bidStatusConfig = {
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札ステータスバッジ
 * @param status 入札ステータス
 */
export function BidStatusBadge({ status }: { status: BidStatus }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const config = bidStatusConfig[status];
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const taskStatusConfig = {
  [TaskStatus.PENDING]: {
    label: "進行中",
    variant: "default" as const,
  },
  [TaskStatus.AUCTION_ACTIVE]: {
    label: "開催中",
    variant: "default" as const,
  },
  [TaskStatus.AUCTION_ENDED]: {
    label: "終了",
    variant: "outline" as const,
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
  [TaskStatus.SUPPLIER_DONE]: {
    label: "提供の完了",
    variant: "success" as const,
  },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスバッジ（オークション以外も含む）
 * @param status タスクステータス
 */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // SUPPLIER_DONEまたはTASK_COMPLETEDなら「タスク完了」バッジ
  if (status === TaskStatus.SUPPLIER_DONE || status === TaskStatus.TASK_COMPLETED) {
    return <Badge variant="success">タスク完了</Badge>;
  }
  const config = taskStatusConfig[status];
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  if (!config) {
    // 万が一未定義のステータスが来た場合のフォールバック
    return <Badge variant="outline">不明</Badge>;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
