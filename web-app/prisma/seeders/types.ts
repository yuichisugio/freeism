import type { ContributionType, TaskStatus } from "@prisma/client";
import type { JsonValue } from "@prisma/client/runtime/library";

export type OAuthProvider = "google" | "github" | "facebook";
export type EvaluationMethod = "360度評価" | "相互評価" | "目標達成度" | "KPI評価" | "コンピテンシー評価";

export type SeedUser = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  isAppOwner: boolean;
  emailVerified?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SeedGroup = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  depositPeriod: number;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isBlackList: JsonValue;
};

export type SeedParticipant = {
  name: string | null;
  userId?: string | null;
};

export type SeedTask = {
  id: string;
  task: string;
  detail?: string | null;
  reference?: string | null;
  category?: string | null;
  status: string;
  fixedContributionPoint?: number | null;
  fixedEvaluatorId?: string | null;
  fixedEvaluationLogic?: string | null;
  fixedEvaluationDate?: Date | null;
  userFixedSubmitterId?: string | null;
  info?: string | null;
  imageUrl?: string | null;
  contributionType: ContributionType;
  deliveryMethod?: string | null;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  groupId: string;
  userId?: string;
  reporters?: SeedParticipant[];
  executors?: SeedParticipant[];
};

export type SeedAuction = {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  currentHighestBid: number;
  currentHighestBidderId?: string | null;
  winnerId?: string | null;
  status: TaskStatus;
  isExtension: boolean;
  extensionTotalCount: number;
  extensionLimitCount: number;
  extensionTime: number;
  remainingTimeForExtension: number;
  createdAt: Date;
  updatedAt: Date;
  groupId: string;
};
