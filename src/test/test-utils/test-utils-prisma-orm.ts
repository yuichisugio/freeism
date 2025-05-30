import type {
  Account,
  Analytics,
  Auction,
  AuctionMessage,
  AuctionReview,
  AutoBid,
  BidHistory,
  Group,
  GroupMembership,
  GroupPoint,
  Notification,
  PushSubscription,
  Session,
  Task,
  TaskExecutor,
  TaskReporter,
  TaskWatchList,
  User,
  UserSettings,
  VerificationToken,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import {
  AuctionEventType,
  BidStatus,
  contributionType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
  ReviewPosition,
  TaskStatus,
} from "@prisma/client";
import { Factory } from "fishery";

const randomAuctionEventType = () => {
  const eventTypes = Object.values(AuctionEventType);
  return eventTypes[Math.floor(Math.random() * eventTypes.length)];
};

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

// アカウントファクトリー
export const accountFactory = Factory.define<Account>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  type: params.type ?? "oauth",
  provider: params.provider ?? "google",
  providerAccountId: params.providerAccountId ?? `provider-${sequence}`,
  refresh_token: params.refresh_token ?? faker.string.alphanumeric(50),
  access_token: params.access_token ?? faker.string.alphanumeric(50),
  expires_at: params.expires_at ?? faker.number.int({ min: 1000000000, max: 9999999999 }),
  token_type: params.token_type ?? "Bearer",
  scope: params.scope ?? "read write",
  id_token: params.id_token ?? faker.string.alphanumeric(100),
  session_state: params.session_state ?? faker.string.alphanumeric(20),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  userId: params.userId ?? `user-${sequence}`,
}));

// セッションファクトリー
export const sessionFactory = Factory.define<Session>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  sessionToken: params.sessionToken ?? faker.string.alphanumeric(50),
  userId: params.userId ?? `user-${sequence}`,
  expires: params.expires ?? faker.date.future(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// 認証トークンファクトリー
export const verificationTokenFactory = Factory.define<VerificationToken>(({ params }) => ({
  identifier: params.identifier ?? faker.internet.email(),
  token: params.token ?? faker.string.alphanumeric(50),
  expires: params.expires ?? faker.date.future(),
  createdAt: params.createdAt ?? faker.date.past(),
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

// グループポイントファクトリー
export const groupPointFactory = Factory.define<GroupPoint>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  userId: params.userId ?? `user-${sequence}`,
  groupId: params.groupId ?? `group-${sequence}`,
  balance: params.balance ?? faker.number.int({ min: 0, max: 1000 }),
  fixedTotalPoints: params.fixedTotalPoints ?? faker.number.int({ min: 0, max: 5000 }),
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

// タスクレポーターファクトリー
export const taskReporterFactory = Factory.define<TaskReporter>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  name: params.name ?? faker.person.fullName(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  taskId: params.taskId ?? `task-${sequence}`,
  userId: params.userId ?? null,
}));

// タスク実行者ファクトリー
export const taskExecutorFactory = Factory.define<TaskExecutor>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  name: params.name ?? faker.person.fullName(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  taskId: params.taskId ?? `task-${sequence}`,
  userId: params.userId ?? null,
}));

// アナリティクスファクトリー
export const analyticsFactory = Factory.define<Analytics>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  evaluator: params.evaluator ?? `user-${sequence}`,
  contributionPoint: params.contributionPoint ?? faker.number.int({ min: 1, max: 100 }),
  createdAt: params.createdAt ?? faker.date.past(),
  evaluationLogic: params.evaluationLogic ?? "自動評価ロジック",
  groupId: params.groupId ?? `group-${sequence}`,
  taskId: params.taskId ?? `task-${sequence}`,
  updatedAt: params.updatedAt ?? new Date(),
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

// 自動入札ファクトリー
export const autoBidFactory = Factory.define<AutoBid>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  userId: params.userId ?? `user-${sequence}`,
  auctionId: params.auctionId ?? `auction-${sequence}`,
  maxBidAmount: params.maxBidAmount ?? faker.number.int({ min: 100, max: 10000 }),
  bidIncrement: params.bidIncrement ?? faker.number.int({ min: 1, max: 10 }),
  lastBidTime: params.lastBidTime ?? null,
  isActive: params.isActive ?? true,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
}));

// タスクウォッチリストファクトリー
export const taskWatchListFactory = Factory.define<TaskWatchList>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  auctionId: params.auctionId ?? `auction-${sequence}`,
  userId: params.userId ?? `user-${sequence}`,
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
  auctionEventType: params.auctionEventType ?? randomAuctionEventType(),
  auctionId: params.auctionId ?? null,
  isRead: params.isRead ?? {},
  sendMethods: params.sendMethods ?? [NotificationSendMethod.IN_APP],
  senderUserId: params.senderUserId ?? null,
}));

// プッシュ通知購読ファクトリー
export const pushSubscriptionFactory = Factory.define<PushSubscription>(({ sequence, params }) => ({
  id: crypto.randomUUID(),
  endpoint: params.endpoint ?? faker.internet.url(),
  p256dh: params.p256dh ?? faker.string.alphanumeric(50),
  auth: params.auth ?? faker.string.alphanumeric(30),
  expirationTime: params.expirationTime ?? faker.date.future(),
  userId: params.userId ?? `user-${sequence}`,
  createdAt: params.createdAt ?? faker.date.past(),
  updatedAt: params.updatedAt ?? new Date(),
  deviceId: params.deviceId ?? faker.string.alphanumeric(20),
}));
