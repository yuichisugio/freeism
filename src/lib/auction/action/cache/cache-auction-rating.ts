"use cache";

import type { DisplayUserInfo } from "@/components/auction/common/auction-rating";
import type { Prisma } from "@prisma/client";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ReviewPosition } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー情報
 */
type UserWithSettings = {
  id: string;
  image: string | null;
  settings?: { username: string } | null;
};

/**
 * ロール
 */
type Role = "creator" | "reporter" | "executor" | "winner";

/**
 * ユーザー情報のオブジェクト
 */
type UserRole = { role: Role; user: UserWithSettings };

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * auctionIdに紐づくTaskのCreator, Reporter, ExecutorごとにDisplayUserInfoを返す
 */
export async function getCachedDisplayUserInfo(auctionId: string, reviewPosition: ReviewPosition): Promise<DisplayUserInfo[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュタグを設定
   */
  cacheTag(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * バリデーション
   */
  if (!auctionId || !reviewPosition) {
    throw new Error("Invalid auctionId or reviewPosition");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 0. 取得するデータのselect条件
   */
  let selectCondition: Prisma.AuctionSelect = {
    id: true,
  };

  // SELLER_TO_BUYER: 落札者（winner）のみ取得
  if (reviewPosition === ReviewPosition.SELLER_TO_BUYER) {
    selectCondition = {
      ...selectCondition,
      winner: {
        select: {
          id: true,
          image: true,
          settings: { select: { username: true } },
        },
      },
    };
  }

  // BUYER_TO_SELLER: 出品者（creator, reporters, executors）を取得
  if (reviewPosition === ReviewPosition.BUYER_TO_SELLER) {
    selectCondition = {
      ...selectCondition,
      task: {
        select: {
          id: true,
          creator: {
            select: {
              id: true,
              image: true,
              settings: { select: { username: true } },
            },
          },
          reporters: {
            select: {
              user: {
                select: {
                  id: true,
                  image: true,
                  settings: { select: { username: true } },
                },
              },
            },
          },
          executors: {
            select: {
              user: {
                select: {
                  id: true,
                  image: true,
                  settings: { select: { username: true } },
                },
              },
            },
          },
        },
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1. auctionIdからTask, Creator, Reporter, Executorを取得
   */
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: selectCondition,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 2. データがない場合は空配列を返す
   */
  if (reviewPosition === ReviewPosition.SELLER_TO_BUYER && !auction?.winner) return [];
  if (reviewPosition === ReviewPosition.BUYER_TO_SELLER && !auction?.task) return [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 3. Creator, Reporter, ExecutorのユーザーIDリストを作成
   */
  const users: UserRole[] = [];

  if (reviewPosition === ReviewPosition.BUYER_TO_SELLER) {
    const task = auction?.task as Partial<{
      creator: UserWithSettings;
      reporters: { user: UserWithSettings | null }[];
      executors: { user: UserWithSettings | null }[];
    }>;
    if (task?.creator) {
      users.push({ role: "creator", user: task.creator });
    }
    task?.reporters?.forEach((r) => {
      if (r.user) users.push({ role: "reporter", user: r.user });
    });
    task?.executors?.forEach((e) => {
      if (e.user) users.push({ role: "executor", user: e.user });
    });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 4. 重複排除（同じユーザーが複数ロールを持つ場合）
   */
  const userMap = new Map<string, { roles: Set<Role>; user: UserWithSettings }>();

  // BUYER_TO_SELLER の場合は Creator, Reporter, Executorを取得
  if (reviewPosition === ReviewPosition.BUYER_TO_SELLER) {
    users.forEach(({ role, user }) => {
      // userIdがまだない場合は、userIdをキーにして、rolesとして、空のsetを追加して、userを追加
      if (!userMap.has(user.id)) userMap.set(user.id, { roles: new Set<Role>(), user });
      // userIdがすでにある場合は、rolesにroleを追加
      userMap.get(user.id)!.roles.add(role);
    });
  }

  // SELLER_TO_BUYER の場合は winner のみ
  if (reviewPosition === ReviewPosition.SELLER_TO_BUYER && auction?.winner) {
    userMap.set(auction.winner.id, { roles: new Set<Role>(["winner"]), user: auction.winner });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 5. 各ユーザーごとに平均rating・hasReviewedを取得
   */
  // .keys()でuserIdのみの配列を作成
  const userIds = Array.from(userMap.keys());
  // 表示するユーザーがいない場合（reviewPositionがSELLER_TO_BUYERの場合は、まだ落札者がいない場合）は空配列を返す
  if (userIds.length === 0) return [];

  // 表示するユーザーのレビューを取得
  const reviews = await prisma.auctionReview.findMany({
    where: { revieweeId: { in: userIds } },
    select: { revieweeId: true, rating: true, auctionId: true },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 6. 今回のオークションで既に評価されているか
   */
  // 今回のオークションで既に評価されているか
  const reviewsForThisAuction = await prisma.auctionReview.findMany({
    where: { auctionId, revieweeId: { in: userIds }, reviewPosition },
    select: { revieweeId: true, comment: true },
  });
  // BUYER_TO_SELLER の場合は Creator, Reporter, Executorを取得して、作成者と報告者と実行者で重複している場合があるため
  const reviewedSet = new Set(reviewsForThisAuction.map((r) => r.revieweeId));
  // 各ユーザーのコメントをMapで管理
  const reviewCommentMap = new Map<string, string | null>();
  reviewsForThisAuction.forEach((r) => {
    reviewCommentMap.set(r.revieweeId, r.comment ?? null);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 7. 平均rating計算
   */
  const ratingMap = new Map<string, number>();
  userIds.forEach((uid) => {
    const userReviews = reviews.filter((r) => r.revieweeId === uid);
    const avg = userReviews.length > 0 ? userReviews.reduce((acc, r) => acc + r.rating, 0) / userReviews.length : 0;
    ratingMap.set(uid, Math.floor(avg)); // 整数部分のみ取得（小数点以下切り捨て）
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 8. DisplayUserInfo型で返却
   */
  const returnValue = userIds.map((uid) => {
    const { user, roles } = userMap.get(uid)!;
    return {
      userId: user.id,
      appUserName: (user.settings as { username: string } | null)?.username ?? "未設定",
      userImage: user.image ?? null,
      creatorId: roles.has("creator") ? user.id : null,
      reporterId: roles.has("reporter") ? user.id : null,
      executorId: roles.has("executor") ? user.id : null,
      rating: ratingMap.get(uid) ?? 0,
      ratingCount: reviews.filter((r) => r.revieweeId === uid).length,
      hasReviewed: reviewedSet.has(uid),
      auctionId,
      reviewComment: reviewCommentMap.get(uid) ?? null,
    };
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 9. 返却
   */
  return returnValue;
}
