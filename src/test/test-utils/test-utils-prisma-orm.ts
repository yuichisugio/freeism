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

// 必須フィールドを明示的にundefinedにできるオプション型を定義
type RequiredFieldsUndefined<T> = {
  [K in keyof T]?: T[K] | undefined;
};

// ユーザーファクトリー - 必須: email
export const userFactory = Factory.define<User>(({ params }) => {
  const data: RequiredFieldsUndefined<User> = {
    id: params.id ?? crypto.randomUUID(),
    name: params.name ?? faker.person.fullName(),
    email: params.email ?? faker.internet.email(), // 必須フィールド
    image: params.image ?? faker.image.avatar(),
    createdAt: params.createdAt ?? faker.date.past(),
    emailVerified: params.emailVerified ?? faker.date.past(),
    isAppOwner: params.isAppOwner ?? false,
    updatedAt: params.updatedAt ?? new Date(),
  };

  // 必須フィールドがundefinedの場合はそのまま返す（エラーテスト用）
  return data as User;
});

// アカウントファクトリー - 必須: type, provider, providerAccountId, userId
export const accountFactory = Factory.define<Account>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Account> = {
    id: params.id ?? crypto.randomUUID(),
    type: params.type ?? "oauth", // 必須フィールド
    provider: params.provider ?? "google", // 必須フィールド
    providerAccountId: params.providerAccountId ?? `provider-${sequence}`, // 必須フィールド
    refresh_token: params.refresh_token ?? faker.string.alphanumeric(50),
    access_token: params.access_token ?? faker.string.alphanumeric(50),
    expires_at: params.expires_at ?? faker.number.int({ min: 1000000000, max: 9999999999 }),
    token_type: params.token_type ?? "Bearer",
    scope: params.scope ?? "read write",
    id_token: params.id_token ?? faker.string.alphanumeric(100),
    session_state: params.session_state ?? faker.string.alphanumeric(20),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
  };

  return data as Account;
});

// セッションファクトリー - 必須: sessionToken, userId, expires
export const sessionFactory = Factory.define<Session>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Session> = {
    id: params.id ?? crypto.randomUUID(),
    sessionToken: params.sessionToken ?? faker.string.alphanumeric(50), // 必須フィールド
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
    expires: params.expires ?? faker.date.future(), // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as Session;
});

// 認証トークンファクトリー - 必須: identifier, token, expires
export const verificationTokenFactory = Factory.define<VerificationToken>(({ params }) => {
  const data: RequiredFieldsUndefined<VerificationToken> = {
    identifier: params.identifier ?? faker.internet.email(), // 必須フィールド
    token: params.token ?? faker.string.alphanumeric(50), // 必須フィールド
    expires: params.expires ?? faker.date.future(), // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as VerificationToken;
});

// ユーザー設定ファクトリー - 必須: userId
export const userSettingsFactory = Factory.define<UserSettings>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<UserSettings> = {
    id: params.id ?? crypto.randomUUID(),
    username: params.username ?? faker.internet.username(),
    lifeGoal: params.lifeGoal ?? faker.lorem.sentence(),
    isEmailEnabled: params.isEmailEnabled ?? faker.datatype.boolean(),
    isPushEnabled: params.isPushEnabled ?? faker.datatype.boolean(),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
  };

  return data as UserSettings;
});

// グループファクトリー - 必須: name, goal, evaluationMethod, createdBy
export const groupFactory = Factory.define<Group>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Group> = {
    id: params.id ?? crypto.randomUUID(),
    name: params.name ?? `テストグループ${sequence}`, // 必須フィールド
    goal: params.goal ?? faker.lorem.sentence(), // 必須フィールド
    depositPeriod: params.depositPeriod ?? faker.number.int({ min: 1, max: 30 }),
    maxParticipants: params.maxParticipants ?? faker.number.int({ min: 1, max: 100 }),
    createdAt: params.createdAt ?? faker.date.past(),
    createdBy: params.createdBy ?? `user-${sequence}`, // 必須フィールド
    evaluationMethod: params.evaluationMethod ?? "自動評価", // 必須フィールド
    isBlackList: params.isBlackList ?? null,
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as Group;
});

// グループメンバーシップファクトリー - 必須: groupId, userId
export const groupMembershipFactory = Factory.define<GroupMembership>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<GroupMembership> = {
    id: params.id ?? crypto.randomUUID(),
    groupId: params.groupId ?? `group-${sequence}`, // 必須フィールド
    isGroupOwner: params.isGroupOwner ?? false,
    joinedAt: params.joinedAt ?? faker.date.past(),
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as GroupMembership;
});

// グループポイントファクトリー - 必須: userId, groupId
export const groupPointFactory = Factory.define<GroupPoint>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<GroupPoint> = {
    id: params.id ?? crypto.randomUUID(),
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
    groupId: params.groupId ?? `group-${sequence}`, // 必須フィールド
    balance: params.balance ?? faker.number.int({ min: 0, max: 1000 }),
    fixedTotalPoints: params.fixedTotalPoints ?? faker.number.int({ min: 0, max: 5000 }),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as GroupPoint;
});

// タスクファクトリー - 必須: task, groupId, creatorId
export const taskFactory = Factory.define<Task>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Task> = {
    id: params.id ?? crypto.randomUUID(),
    task: params.task ?? faker.lorem.sentence(), // 必須フィールド
    reference: params.reference ?? faker.internet.url(),
    groupId: params.groupId ?? `group-${sequence}`, // 必須フィールド
    status: params.status ?? TaskStatus.PENDING,
    info: params.info ?? faker.lorem.paragraph(),
    detail: params.detail ?? faker.lorem.paragraphs(),
    contributionType: params.contributionType ?? contributionType.NON_REWARD,
    createdAt: params.createdAt ?? faker.date.past(),
    creatorId: params.creatorId ?? `user-${sequence}`, // 必須フィールド
    fixedContributionPoint: params.fixedContributionPoint ?? null,
    fixedEvaluationDate: params.fixedEvaluationDate ?? null,
    fixedEvaluationLogic: params.fixedEvaluationLogic ?? null,
    fixedEvaluatorId: params.fixedEvaluatorId ?? null,
    imageUrl: params.imageUrl ?? faker.image.url(),
    updatedAt: params.updatedAt ?? new Date(),
    userFixedSubmitterId: params.userFixedSubmitterId ?? null,
    deliveryMethod: params.deliveryMethod ?? "オンライン",
    category: params.category ?? "その他",
  };

  return data as Task;
});

// タスクレポーターファクトリー - 必須: taskId
export const taskReporterFactory = Factory.define<TaskReporter>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<TaskReporter> = {
    id: params.id ?? crypto.randomUUID(),
    name: params.name ?? faker.person.fullName(),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    taskId: params.taskId ?? `task-${sequence}`, // 必須フィールド
    userId: params.userId ?? null,
  };

  return data as TaskReporter;
});

// タスク実行者ファクトリー - 必須: taskId
export const taskExecutorFactory = Factory.define<TaskExecutor>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<TaskExecutor> = {
    id: params.id ?? crypto.randomUUID(),
    name: params.name ?? faker.person.fullName(),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    taskId: params.taskId ?? `task-${sequence}`, // 必須フィールド
    userId: params.userId ?? null,
  };

  return data as TaskExecutor;
});

// アナリティクスファクトリー - 必須: evaluator, contributionPoint, evaluationLogic, groupId, taskId
export const analyticsFactory = Factory.define<Analytics>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Analytics> = {
    id: params.id ?? crypto.randomUUID(),
    evaluator: params.evaluator ?? `user-${sequence}`, // 必須フィールド
    contributionPoint: params.contributionPoint ?? faker.number.int({ min: 1, max: 100 }), // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    evaluationLogic: params.evaluationLogic ?? "自動評価ロジック", // 必須フィールド
    groupId: params.groupId ?? `group-${sequence}`, // 必須フィールド
    taskId: params.taskId ?? `task-${sequence}`, // 必須フィールド
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as Analytics;
});

// オークションファクトリー - 必須: startTime, endTime, groupId, taskId
export const auctionFactory = Factory.define<Auction>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<Auction> = {
    id: params.id ?? crypto.randomUUID(),
    startTime: params.startTime ?? faker.date.past(), // 必須フィールド
    endTime: params.endTime ?? faker.date.future(), // 必須フィールド
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
    groupId: params.groupId ?? `group-${sequence}`, // 必須フィールド
    taskId: params.taskId ?? `task-${sequence}`, // 必須フィールド
    winnerId: params.winnerId ?? null,
  };

  return data as Auction;
});

// 入札履歴ファクトリー - 必須: amount, auctionId, userId
export const bidHistoryFactory = Factory.define<BidHistory>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<BidHistory> = {
    id: params.id ?? crypto.randomUUID(),
    amount: params.amount ?? faker.number.int({ min: 1, max: 1000 }), // 必須フィールド
    isAutoBid: params.isAutoBid ?? false,
    status: params.status ?? BidStatus.BIDDING,
    depositPoint: params.depositPoint ?? null,
    auctionId: params.auctionId ?? `auction-${sequence}`, // 必須フィールド
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as BidHistory;
});

// 自動入札ファクトリー - 必須: userId, auctionId, maxBidAmount
export const autoBidFactory = Factory.define<AutoBid>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<AutoBid> = {
    id: params.id ?? crypto.randomUUID(),
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
    auctionId: params.auctionId ?? `auction-${sequence}`, // 必須フィールド
    maxBidAmount: params.maxBidAmount ?? faker.number.int({ min: 100, max: 10000 }), // 必須フィールド
    bidIncrement: params.bidIncrement ?? faker.number.int({ min: 1, max: 10 }),
    lastBidTime: params.lastBidTime ?? null,
    isActive: params.isActive ?? true,
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as AutoBid;
});

// タスクウォッチリストファクトリー - 必須: auctionId, userId
export const taskWatchListFactory = Factory.define<TaskWatchList>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<TaskWatchList> = {
    id: params.id ?? crypto.randomUUID(),
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    auctionId: params.auctionId ?? `auction-${sequence}`, // 必須フィールド
    userId: params.userId ?? `user-${sequence}`, // 必須フィールド
  };

  return data as TaskWatchList;
});

// オークションメッセージファクトリー - 必須: auctionId, senderId, message
export const auctionMessageFactory = Factory.define<AuctionMessage>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<AuctionMessage> = {
    id: params.id ?? crypto.randomUUID(),
    auctionId: params.auctionId ?? `auction-${sequence}`, // 必須フィールド
    senderId: params.senderId ?? `user-${sequence}`, // 必須フィールド
    message: params.message ?? faker.lorem.sentence(), // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as AuctionMessage;
});

// オークションレビューファクトリー - 必須: auctionId, reviewerId, revieweeId, rating, reviewPosition
export const auctionReviewFactory = Factory.define<AuctionReview>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<AuctionReview> = {
    id: params.id ?? crypto.randomUUID(),
    auctionId: params.auctionId ?? `auction-${sequence}`, // 必須フィールド
    reviewerId: params.reviewerId ?? `user-${sequence}`, // 必須フィールド
    revieweeId: params.revieweeId ?? `user-${sequence + 1}`, // 必須フィールド
    rating: params.rating ?? faker.number.int({ min: 1, max: 5 }), // 必須フィールド
    comment: params.comment ?? faker.lorem.paragraph(),
    completionProofUrl: params.completionProofUrl ?? faker.internet.url(),
    reviewPosition: params.reviewPosition ?? ReviewPosition.BUYER_TO_SELLER, // 必須フィールド
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
  };

  return data as AuctionReview;
});

// 通知ファクトリー - 必須: title, message, targetType, sendTimingType, isRead, sendMethods
export const notificationFactory = Factory.define<Notification>(({ params }) => {
  const data: RequiredFieldsUndefined<Notification> = {
    id: params.id ?? crypto.randomUUID(),
    title: params.title ?? faker.lorem.words(3), // 必須フィールド
    message: params.message ?? faker.lorem.sentence(), // 必須フィールド
    actionUrl: params.actionUrl ?? faker.internet.url(),
    expiresAt: params.expiresAt ?? faker.date.future(),
    groupId: params.groupId ?? null,
    sentAt: params.sentAt ?? null,
    targetType: params.targetType ?? NotificationTargetType.USER, // 必須フィールド
    taskId: params.taskId ?? null,
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    sendScheduledDate: params.sendScheduledDate ?? null,
    sendTimingType: params.sendTimingType ?? NotificationSendTiming.NOW, // 必須フィールド
    auctionEventType: params.auctionEventType ?? randomAuctionEventType(),
    auctionId: params.auctionId ?? null,
    isRead: params.isRead ?? {}, // 必須フィールド
    sendMethods: params.sendMethods ?? [NotificationSendMethod.IN_APP], // 必須フィールド
    senderUserId: params.senderUserId ?? null,
  };

  return data as Notification;
});

// プッシュ通知購読ファクトリー - 必須フィールドなし（すべてoptional）
export const pushSubscriptionFactory = Factory.define<PushSubscription>(({ sequence, params }) => {
  const data: RequiredFieldsUndefined<PushSubscription> = {
    id: params.id ?? crypto.randomUUID(),
    endpoint: params.endpoint ?? faker.internet.url(),
    p256dh: params.p256dh ?? faker.string.alphanumeric(50),
    auth: params.auth ?? faker.string.alphanumeric(30),
    expirationTime: params.expirationTime ?? faker.date.future(),
    userId: params.userId ?? `user-${sequence}`,
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? new Date(),
    deviceId: params.deviceId ?? faker.string.alphanumeric(20),
  };

  return data as PushSubscription;
});

// 異常系テスト用のヘルパー関数
export const createInvalidUserData = () => userFactory.build({ email: undefined });
export const createInvalidAccountData = () => accountFactory.build({ type: undefined, provider: undefined });
export const createInvalidSessionData = () => sessionFactory.build({ sessionToken: undefined, userId: undefined });
export const createInvalidGroupData = () => groupFactory.build({ name: undefined, goal: undefined });
export const createInvalidTaskData = () =>
  taskFactory.build({ task: undefined, groupId: undefined, creatorId: undefined });
export const createInvalidAuctionData = () =>
  auctionFactory.build({ startTime: undefined, endTime: undefined, groupId: undefined, taskId: undefined });
export const createInvalidBidHistoryData = () =>
  bidHistoryFactory.build({ amount: undefined, auctionId: undefined, userId: undefined });
export const createInvalidNotificationData = () =>
  notificationFactory.build({ title: undefined, message: undefined, targetType: undefined });

/**
 * GroupDetailTask型のファクトリー（テスト用）
 */
export const groupDetailTaskFactory = Factory.define<{
  id: string;
  auctionId: string | null;
  taskName: string;
  taskDetail: string | null;
  taskStatus: string;
  taskContributionType: contributionType;
  taskFixedContributionPoint: number | null;
  taskFixedEvaluator: string | null;
  taskFixedEvaluationLogic: string | null;
  taskCreator: string | null;
  taskReporterUserIds: string[] | null;
  taskExecutorUserIds: string[] | null;
  taskReporterUserNames: string[] | null;
  taskExecutorUserNames: string[] | null;
  createdAt: Date;
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: { userId: string }[];
    depositPeriod?: number;
  };
}>(({ sequence, params }) => ({
  id: params.id ?? `task-${sequence}`,
  auctionId: params.auctionId ?? null,
  taskName: params.taskName ?? faker.lorem.sentence(),
  taskDetail: params.taskDetail ?? faker.lorem.paragraph(),
  taskStatus: params.taskStatus ?? TaskStatus.PENDING,
  taskContributionType: params.taskContributionType ?? contributionType.NON_REWARD,
  taskFixedContributionPoint: params.taskFixedContributionPoint ?? null,
  taskFixedEvaluator: params.taskFixedEvaluator ?? null,
  taskFixedEvaluationLogic: params.taskFixedEvaluationLogic ?? null,
  taskCreator: params.taskCreator ?? faker.person.fullName(),
  taskReporterUserIds: params.taskReporterUserIds ?? null,
  taskExecutorUserIds: params.taskExecutorUserIds ?? null,
  taskReporterUserNames: params.taskReporterUserNames ?? null,
  taskExecutorUserNames: params.taskExecutorUserNames ?? null,
  createdAt: params.createdAt ?? faker.date.past(),
  group: {
    id: params.group?.id ?? `group-${sequence}`,
    name: params.group?.name ?? faker.company.name(),
    maxParticipants: params.group?.maxParticipants ?? faker.number.int({ min: 5, max: 50 }),
    goal: params.group?.goal ?? faker.lorem.sentence(),
    evaluationMethod: params.group?.evaluationMethod ?? "自動評価",
    members: params.group?.members ?? [{ userId: `user-${sequence}` }],
    depositPeriod: params.group?.depositPeriod ?? faker.number.int({ min: 1, max: 30 }),
  },
}));

/**
 * TaskParticipant型のファクトリー（テスト用）
 */
export const taskParticipantFactory = Factory.define<{
  appUserName: string | null;
  appUserId: string | null;
}>(({ sequence, params }) => ({
  appUserName: params.appUserName ?? faker.person.fullName(),
  appUserId: params.appUserId ?? `user-${sequence}`,
}));
