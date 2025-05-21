"use client";

import { memo, useCallback, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getAuctionReview } from "@/lib/auction/action/auction-review-rating";
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
  displayUserInfo: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  auctionId: string;
  displayReviewPosition: ReviewPosition;
  text: "出品者" | "落札者";
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価コンポーネント
 */
export const QARating = memo(function QARating(props: QARatingProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * propsから取得
   */
  const { displayUserInfo, auctionId, displayReviewPosition, text } = props;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション情報
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const { data: auctionReview, isPending: isAuctionReviewPending } = useQuery({
    queryKey: ["auctionReview", auctionId],
    queryFn: () => getAuctionReview(auctionId, displayUserInfo?.id ?? "", displayReviewPosition),
    enabled: !!displayUserInfo?.id && !!auctionId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューを送信する
   */
  const queryClient = useQueryClient();
  const { mutate: createAuctionReviewMutation, isPending: isSubmittingReview } = useMutation({
    mutationFn: async (params: { rating: number; comment: string }) => {
      if (!auctionId || !displayUserInfo?.id) {
        throw new Error("オークションIDまたは落札者IDが無効です。");
      }
      return createAuctionReview(auctionId, displayUserInfo.id, params.rating, params.comment, displayReviewPosition);
    },
    onSuccess: () => {
      toast.success("評価を送信しました");
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId ?? "", auctionId) });
      setRating(0);
      setComment("");
      setHasReviewed(true);
    },
    onError: (error: Error) => {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました: " + error.message);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューを送信する
   */
  const handleReviewSubmit = useCallback(async () => {
    if (!displayUserInfo?.id) {
      toast.error("落札者がいないため評価できません");
      return;
    }
    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }
    if (!auctionId || !userId) {
      toast.error("オークション情報または作成者情報が不足しています。");
      return;
    }
    createAuctionReviewMutation({ rating, comment });
  }, [auctionId, displayUserInfo?.id, userId, comment, rating, createAuctionReviewMutation]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価コンポーネント
   */
  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{text}情報</CardTitle>
        </CardHeader>
        <CardContent>
          {isAuctionReviewPending || !auctionReview ? (
            <div>表示対象者はまだ存在しません</div>
          ) : (
            <div className="mb-4 flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={displayUserInfo?.image ?? ""} alt={displayUserInfo?.name ?? text} />
                <AvatarFallback>{displayUserInfo?.name?.[0] ?? text}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{displayUserInfo?.name ?? text}</p>
                <div className="flex items-center gap-2">
                  <RatingStar rating={auctionReview?.rating ?? 0} size={16} />
                  <span className="text-sm text-gray-500">({displayReviewPosition === ReviewPosition.SELLER_TO_BUYER ? 1 : 0})</span>
                </div>
              </div>
            </div>
          )}
          {hasReviewed ? (
            <div className="py-4 text-center">
              <p className="mb-2 text-gray-500">評価済みです</p>
              <div className="flex justify-center">
                <RatingStar rating={auctionReview?.rating ?? 0} size={24} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
                disabled={rating === 0 || isSubmittingReview || !displayUserInfo?.id || !userId}
              >
                {isSubmittingReview ? "送信中..." : "評価を送信"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});
