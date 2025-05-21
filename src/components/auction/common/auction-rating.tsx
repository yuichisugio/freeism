"use client";

import { memo, useCallback, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Textarea } from "@/components/ui/textarea";
import { getDisplayUserInfo } from "@/lib/auction/action/auction-rating";
import { createAuctionReview } from "@/lib/auction/action/history";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { ReviewPosition } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { RatingStar } from "./rating-star";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価コンポーネントのprops
 */
type QARatingProps = {
  auctionId: string;
  text: "出品画面" | "落札画面";
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各ユーザーの評価カード
 */
function UserRatingCard({ user, reviewPosition }: { user: DisplayUserInfo; reviewPosition: ReviewPosition }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(user.hasReviewed);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  const { mutate: createAuctionReviewMutation, isPending: isSubmittingReview } = useMutation({
    mutationFn: async (params: { rating: number; comment: string }) => {
      if (!user.auctionId || !user.userId) {
        throw new Error("オークションIDまたはユーザーIDが無効です。");
      }
      return createAuctionReview(user.auctionId, user.userId, params.rating, params.comment, reviewPosition);
    },
    onSuccess: () => {
      toast.success("評価を送信しました");
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(user.userId ?? "", user.auctionId) });
      setRating(0);
      setComment("");
      setHasReviewed(true);
    },
    onError: (error: Error) => {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました: " + error.message);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価送信
   */
  const handleReviewSubmit = useCallback(async () => {
    if (!user.userId) {
      toast.error("ユーザーがいないため評価できません");
      return;
    }
    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }
    if (!user.auctionId || !user.userId) {
      toast.error("オークション情報または作成者情報が不足しています。");
      return;
    }
    createAuctionReviewMutation({ rating, comment });
  }, [user.auctionId, user.userId, comment, rating, createAuctionReviewMutation]);

  return (
    <div className="mb-4 flex flex-col items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={user.userImage ?? ""} alt={user.appUserName ?? ""} />
        <AvatarFallback>{user.appUserName?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-center font-medium">{user.appUserName}</p>
        <div className="flex items-center justify-center gap-2">
          <RatingStar rating={user.rating ?? 0} size={16} />
        </div>
      </div>
      {hasReviewed ? (
        <div className="py-4 text-center">
          <p className="mb-2 text-gray-500">評価済みです</p>
          <div className="flex justify-center">
            <RatingStar rating={user.rating ?? 0} size={24} />
          </div>
        </div>
      ) : (
        <div className="w-full space-y-4">
          <div className="text-center">
            <p className="mb-2 text-sm text-gray-500">評価を選択してください</p>
            <div className="flex justify-center">
              <RatingStar rating={rating} size={28} readonly={false} onChange={setRating} />
            </div>
          </div>
          <Textarea placeholder="コメントを入力（任意）" value={comment} onChange={(e) => setComment(e.target.value)} className="h-24" />
          <Button
            className="w-full"
            onClick={() => void handleReviewSubmit()}
            disabled={rating === 0 || isSubmittingReview || !user.userId || !user.auctionId}
          >
            {isSubmittingReview ? "送信中..." : "評価を送信"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 表示するユーザー情報
 */
export type DisplayUserInfo = {
  userId: string;
  appUserName: string;
  userImage: string | null;
  creatorId: string | null;
  reporterId: string | null;
  executorId: string | null;
  rating: number;
  hasReviewed: boolean;
  auctionId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価コンポーネント
 */
export const QARating = memo(function QARating(props: QARatingProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * propsから取得
   */
  const { auctionId, text } = props;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション
   */
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューの向き
   */
  const reviewPosition: ReviewPosition = text === "出品画面" ? ReviewPosition.SELLER_TO_BUYER : ReviewPosition.BUYER_TO_SELLER;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー情報
   */
  const displayText = text === "出品画面" ? "落札者" : "出品者";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * ユーザー情報
   */
  const { data: displayUserInfo = [] } = useQuery({
    queryKey: ["auction", auctionId, userId, reviewPosition],
    queryFn: () => getDisplayUserInfo(auctionId, reviewPosition),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カード
   */
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{displayText}情報</CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel className="mx-auto w-full max-w-xl">
          <CarouselContent>
            {displayUserInfo.length === 0 ? (
              <CarouselItem>
                <div className="p-1">表示対象者はまだ存在しません</div>
              </CarouselItem>
            ) : (
              displayUserInfo.map((user) => (
                <CarouselItem key={user.userId}>
                  <div className="p-1">
                    <UserRatingCard user={user} reviewPosition={reviewPosition} />
                  </div>
                </CarouselItem>
              ))
            )}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  );
});
