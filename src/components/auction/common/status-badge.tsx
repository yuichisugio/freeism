import type { TaskRole } from "@/types/auction-types";
import { Badge } from "@/components/ui/badge";
import { BidStatus, TaskStatus } from "@prisma/client";

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
  if (!config) {
    // 万が一未定義のステータスが来た場合のフォールバック
    return <Badge variant="outline">不明</Badge>;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const taskStatusConfig = {
  [TaskStatus.PENDING]: {
    label: "開始前",
    variant: "default" as const,
  },
  [TaskStatus.AUCTION_ACTIVE]: {
    label: "オークション開催中",
    variant: "default" as const,
  },
  [TaskStatus.AUCTION_ENDED]: {
    label: "オークション終了",
    variant: "outline" as const,
  },
  [TaskStatus.POINTS_DEPOSITED]: {
    label: "ポイント預け済み",
    variant: "secondary" as const,
  },
  [TaskStatus.SUPPLIER_DONE]: {
    label: "出品者の提供完了",
    variant: "success" as const,
  },
  [TaskStatus.TASK_COMPLETED]: {
    label: "落札者のタスク確認完了",
    variant: "success" as const,
  },
  [TaskStatus.FIXED_EVALUATED]: {
    label: "評価FIX済み",
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
  [TaskStatus.AUCTION_CANCELED]: {
    label: "キャンセル",
    variant: "destructive" as const,
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const taskRoleConfig = {
  SUPPLIER: {
    label: "出品者",
    variant: "default",
  },
  EXECUTOR: {
    label: "提供者",
    variant: "default",
  },
  REPORTER: {
    label: "報告者",
    variant: "default",
  },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスバッジ（オークション以外も含む）
 * @param status タスクステータス
 */
export function TaskRoleBadge({ role }: { role: TaskRole[] }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  if (!role) {
    // 万が一未定義のステータスが来た場合のフォールバック
    return <Badge variant="outline">不明</Badge>;
  }
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  let badgeLabel = "";
  for (const r of role) {
    badgeLabel += taskRoleConfig[r].label + "・";
  }
  badgeLabel = badgeLabel.slice(0, -1);
  return <Badge variant="success">{badgeLabel}</Badge>;
}
