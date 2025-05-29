import type {
  Auction,
  AuctionMessage,
  AuctionReview,
  BidHistory,
  Group,
  GroupMembership,
  Notification,
  Task,
  User,
  UserSettings,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import {
  BidStatus,
  contributionType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
  ReviewPosition,
  TaskStatus,
} from "@prisma/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Factory } from "fishery";
import { ThemeProvider } from "next-themes";

// テスト用のQueryClientを作成
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// プロバイダーでラップするコンポーネント
export function AllTheProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// ユーザーファクトリー
export const userFactory = Factory.define<User>(({ params }) => ({
  id: crypto.randomUUID(),
  name: params.name ?? faker.person.fullName(),
  email: params.email ?? faker.internet.email(),
  image: params.image ?? faker.image.avatar(),
  createdAt: params.createdAt ?? faker.date.past(),
  emailVerified: params.emailVerified ?? faker.date.past(),
  isAppOwner: params.isAppOwner ?? false,
  updatedAt: params.updatedAt ?? new Date(),
}));

// ユーザー設定ファクトリー
export const userSettingsFactory = Factory.define<UserSettings>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  username: params.username ?? faker.internet.username(),
  lifeGoal: params.lifeGoal ?? faker.lorem.sentence(),
  isEmailEnabled: params.isEmailEnabled ?? faker.datatype.boolean(),
  isPushEnabled: params.isPushEnabled ?? faker.datatype.boolean(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  userId: params.userId ?? `user-${sequence}`,
}));

// グループファクトリー
export const groupFactory = Factory.define<Group>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  name: params.name ?? `テストグループ${sequence}`,
  goal: params.goal ?? faker.lorem.sentence(),
  depositPeriod: params.depositPeriod ?? faker.number.int({ min: 1, max: 30 }),
  maxParticipants: params.maxParticipants ?? faker.number.int({ min: 1, max: 100 }),
  createdAt: params.createdAt ?? faker.date.past(),
  createdBy: params.createdBy ?? `user-${sequence}`,
  evaluationMethod: params.evaluationMethod ?? "自動評価",
  isBlackList: params.isBlackList ?? null,
  updatedAt: params.updatedAt ?? new Date(),
}));

// グループメンバーシップファクトリー
export const groupMembershipFactory = Factory.define<GroupMembership>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  groupId: params.groupId ?? `group-${sequence}`,
  isGroupOwner: params.isGroupOwner ?? false,
  joinedAt: params.joinedAt ?? faker.date.past(),
  userId: params.userId ?? `user-${sequence}`,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// タスクファクトリー
export const taskFactory = Factory.define<Task>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  task: params.task ?? faker.lorem.sentence(),
  reference: params.reference ?? faker.internet.url(),
  groupId: params.groupId ?? `group-${sequence}`,
  status: params.status ?? TaskStatus.PENDING,
  info: params.info ?? faker.lorem.paragraph(),
  detail: params.detail ?? faker.lorem.paragraphs(),
  contributionType: params.contributionType ?? contributionType.NON_REWARD,
  createdAt: params.createdAt ?? faker.date.past(),
  creatorId: params.creatorId ?? `user-${sequence}`,
  fixedContributionPoint: params.fixedContributionPoint ?? null,
  fixedEvaluationDate: params.fixedEvaluationDate ?? null,
  fixedEvaluationLogic: params.fixedEvaluationLogic ?? null,
  fixedEvaluatorId: params.fixedEvaluatorId ?? null,
  imageUrl: params.imageUrl ?? faker.image.url(),
  updatedAt: params.updatedAt ?? new Date(),
  userFixedSubmitterId: params.userFixedSubmitterId ?? null,
  deliveryMethod: params.deliveryMethod ?? "オンライン",
  category: params.category ?? "その他",
}));

// オークションファクトリー
export const auctionFactory = Factory.define<Auction>(({ sequence, params }) => {
  return {
    id: crypto.randomUUID(),
    startTime: params.startTime ?? faker.date.past(),
    endTime: params.endTime ?? faker.date.future(),
    currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 1, max: 1000 }),
    version: params.version ?? faker.number.int({ min: 1, max: 10 }),
    isExtension: params.isExtension ?? false,
    extensionTotalCount: params.extensionTotalCount ?? faker.number.int({ min: 0, max: 10 }),
    extensionLimitCount: params.extensionLimitCount ?? faker.number.int({ min: 1, max: 10 }),
    extensionTime: params.extensionTime ?? faker.number.int({ min: 1, max: 10 }),
    remainingTimeForExtension: params.remainingTimeForExtension ?? faker.number.int({ min: 1, max: 10 }),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    currentHighestBidderId: params.currentHighestBidderId ?? null,
    groupId: params.groupId ?? `group-${sequence}`,
    taskId: params.taskId ?? `task-${sequence}`,
    winnerId: params.winnerId ?? null,
  };
});

// 入札履歴ファクトリー
export const bidHistoryFactory = Factory.define<BidHistory>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  amount: params.amount ?? faker.number.int({ min: 1, max: 1000 }),
  isAutoBid: params.isAutoBid ?? false,
  status: params.status ?? BidStatus.BIDDING,
  depositPoint: params.depositPoint ?? null,
  auctionId: params.auctionId ?? `auction-${sequence}`,
  userId: params.userId ?? `user-${sequence}`,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// オークションメッセージファクトリー
export const auctionMessageFactory = Factory.define<AuctionMessage>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  auctionId: params.auctionId ?? `auction-${sequence}`,
  senderId: params.senderId ?? `user-${sequence}`,
  message: params.message ?? faker.lorem.sentence(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// オークションレビューファクトリー
export const auctionReviewFactory = Factory.define<AuctionReview>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  auctionId: params.auctionId ?? `auction-${sequence}`,
  reviewerId: params.reviewerId ?? `user-${sequence}`,
  revieweeId: params.revieweeId ?? `user-${sequence + 1}`,
  rating: params.rating ?? faker.number.int({ min: 1, max: 5 }),
  comment: params.comment ?? faker.lorem.paragraph(),
  completionProofUrl: params.completionProofUrl ?? faker.internet.url(),
  reviewPosition: params.reviewPosition ?? ReviewPosition.BUYER_TO_SELLER,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// 通知ファクトリー
export const notificationFactory = Factory.define<Notification>(({ params }) => ({
  id: crypto.randomUUID(),
  title: params.title ?? faker.lorem.words(3),
  message: params.message ?? faker.lorem.sentence(),
  actionUrl: params.actionUrl ?? faker.internet.url(),
  expiresAt: params.expiresAt ?? faker.date.future(),
  groupId: params.groupId ?? null,
  sentAt: params.sentAt ?? null,
  targetType: params.targetType ?? NotificationTargetType.USER,
  taskId: params.taskId ?? null,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  sendScheduledDate: params.sendScheduledDate ?? null,
  sendTimingType: params.sendTimingType ?? NotificationSendTiming.NOW,
  auctionEventType: params.auctionEventType ?? null,
  auctionId: params.auctionId ?? null,
  isRead: params.isRead ?? {},
  sendMethods: params.sendMethods ?? [NotificationSendMethod.IN_APP],
  senderUserId: params.senderUserId ?? null,
}));
