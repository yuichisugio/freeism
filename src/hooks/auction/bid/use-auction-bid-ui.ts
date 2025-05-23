import { useMemo } from "react";
import { notFound } from "next/navigation";
import { type AuctionWithDetails, type TaskRole } from "@/types/auction-types";
import { TaskStatus } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーと役割をまとめた型
 */
export type UserWithRoles = {
  id: string;
  image: string | null;
  username: string;
  roles: TaskRole[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関わる全ユーザーの情報を役割と共に取得
 * @param auction オークション詳細情報
 * @returns ユーザーと役割の配列
 */
function getUsersWithRoles(auction: AuctionWithDetails): UserWithRoles[] {
  const userMap = new Map<string, UserWithRoles>();

  // Creator（出品者）
  if (auction.task.creator) {
    const creator = auction.task.creator;
    userMap.set(creator.id, {
      id: creator.id,
      image: creator.image,
      username: creator.settings?.username ?? "不明なユーザー",
      roles: ["SUPPLIER"],
    });
  }

  // Executors（提供者）
  auction.task.executors.forEach((executor) => {
    if (executor.user) {
      const user = executor.user;
      if (userMap.has(user.id)) {
        userMap.get(user.id)!.roles.push("EXECUTOR");
      } else {
        userMap.set(user.id, {
          id: user.id,
          image: user.image,
          username: user.settings?.username ?? "不明なユーザー",
          roles: ["EXECUTOR"],
        });
      }
    }
  });

  // Reporters（報告者）
  auction.task.reporters.forEach((reporter) => {
    if (reporter.user) {
      const user = reporter.user;
      if (userMap.has(user.id)) {
        userMap.get(user.id)!.roles.push("REPORTER");
      } else {
        userMap.set(user.id, {
          id: user.id,
          image: user.image,
          username: user.settings?.username ?? "不明なユーザー",
          roles: ["REPORTER"],
        });
      }
    }
  });

  return Array.from(userMap.values());
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション入札画面のUI状態を管理するカスタムフック
 * @param auction オークション詳細情報
 * @returns UI状態とハンドラー
 */
export function useAuctionBidUI(auction: AuctionWithDetails) {
  console.log("src/hooks/auction/bid/use-auction-bid-ui.ts_useAuctionBidUI_render");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブ管理（nuqsでURLパラメータとして管理）
   */
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "details",
    clearOnDefault: true,
    history: "replace",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const { data: session } = useSession();
  const currentUserId = useMemo(() => {
    if (!session?.user?.id) {
      notFound();
    }
    return session.user.id;
  }, [session?.user?.id]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションに関わる全ユーザーの情報を取得
   */
  const usersWithRoles = useMemo(() => getUsersWithRoles(auction), [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションがアクティブかどうか
   */
  const isActive = useMemo(() => {
    const auctionStartTime = typeof auction.startTime === "string" ? new Date(auction.startTime) : auction.startTime;
    const auctionEndTime = typeof auction.endTime === "string" ? new Date(auction.endTime) : auction.endTime;
    const now = new Date();
    if (auction.status === TaskStatus.AUCTION_ACTIVE && auctionStartTime < now && auctionEndTime > now) {
      return true;
    } else {
      return false;
    }
  }, [auction.startTime, auction.endTime, auction.status]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者かどうか
   */
  const isExecutor = useMemo(() => {
    console.log(
      "src/hooks/auction/bid/use-auction-bid-ui.ts_isExecutor",
      currentUserId,
      auction.task.executors.map((executor) => executor.user?.id),
    );
    return auction.task.executors.some((executor) => executor.user?.id === currentUserId);
  }, [auction.task.executors, currentUserId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // タブ管理
    activeTab,
    setActiveTab,
    // ユーザー情報
    currentUserId,
    usersWithRoles,
    // オークション状態
    isActive,
    isExecutor,
  };
}
