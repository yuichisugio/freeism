import { type contributionType } from "@prisma/client";

// グループメンバーの型
export type GroupMember = {
  id: string;
  userId: string;
};

// タスク参加者の型
export type TaskParticipant = {
  id: string;
  name: string | null;
  userId: string | null;
  user: {
    id: string;
    name: string | null;
  } | null;
};

// ユーザー情報の型定義
export type User = {
  id: string;
  name: string | null;
  email: string | null;
};

export type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
  contributionType: contributionType;
  // 情報・画像URL・カテゴリを追加
  info: string | null;
  imageUrl: string | null;
  category: string | null;
  // 作成者情報
  creator: {
    id: string;
    name: string | null;
  };
  // 報告者・実行者情報
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: {
      id: string;
      userId: string;
    }[];
    depositPeriod?: number;
  };
  detail: string | null;
};
