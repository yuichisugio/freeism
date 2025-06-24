"use client";

import { memo, useCallback, useState } from "react";
import { createAuctionReview, getDisplayUserInfo } from "@/actions/auction/auction-rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Textarea } from "@/components/ui/textarea";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { ReviewPosition } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2 } from "lucide-react";
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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(user.hasReviewed);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価送信
   */
  const { mutate: createAuctionReviewMutation, isPending: isSubmittingReview } = useMutation({
    mutationFn: async (params: { rating: number; comment: string }) => {
      return createAuctionReview(user.auctionId, user.userId, params.rating, params.comment, reviewPosition);
    },
    onSuccess: () => {
      toast.success("評価を送信しました");
      void queryClient.invalidateQueries({
        queryKey: queryCacheKeys.auction.historyCreatedDetail(user.userId ?? "", user.auctionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryCacheKeys.auction.displayUserInfo(user.auctionId, reviewPosition),
      });
      setRating(0);
      setComment("");
      setHasReviewed(true);
    },
    onError: (error: Error) => {
      console.error("評価の送信に失敗しました：", error.message);
      toast.error("評価の送信に失敗しました");
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
    createAuctionReviewMutation({ rating, comment });
  }, [user.userId, comment, rating, createAuctionReviewMutation]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カード
   */
  return (
    <div className="mb-4 flex flex-col items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={user.userImage ?? ""} alt={user.appUserName ?? ""} />
        <AvatarFallback>{user.appUserName?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-center font-medium">{user.appUserName}</p>
        <div className="flex items-center justify-center gap-2">
          <RatingStar rating={user.rating} size={16} readonly={true} />
          <span className="text-sm text-gray-500">({user.ratingCount})</span>
        </div>
      </div>
      {hasReviewed ? (
        <div className="py-4 text-center">
          <p className="mb-2 text-gray-500">評価済みです</p>
          <div className="flex justify-center">
            <RatingStar rating={user.rating} size={24} readonly={true} />
          </div>
          {user.reviewComment && (
            <div className="bg-muted mt-2 rounded p-2 text-left text-sm text-gray-700">
              <span className="font-bold">コメント：</span> {user.reviewComment}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full space-y-4">
          <div className="text-center">
            <p className="mb-2 text-sm text-gray-500">評価を選択してください</p>
            <div className="flex justify-center">
              <RatingStar rating={rating} size={28} readonly={false} onChange={setRating} />
            </div>
          </div>
          <Textarea
            placeholder="コメントを入力（任意）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="h-24"
          />
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
  ratingCount: number;
  hasReviewed: boolean;
  auctionId: string;
  reviewComment: string | null;
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
   * レビューの向き
   */
  const reviewPosition: ReviewPosition =
    text === "出品画面" ? ReviewPosition.SELLER_TO_BUYER : ReviewPosition.BUYER_TO_SELLER;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー情報
   */
  const displayText = text === "出品画面" ? "落札者" : "出品者";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * ユーザー情報
   */
  const { data: displayUserInfo = [], isPending: isLoadingDisplayUserInfo } = useQuery({
    queryKey: queryCacheKeys.auction.displayUserInfo(auctionId, reviewPosition),
    queryFn: () => getDisplayUserInfo(auctionId, reviewPosition),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!auctionId && !!reviewPosition,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カルーセルの現在ページ管理
  const [currentIndex, setCurrentIndex] = useState(0);

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
        {/* ページインジケータ */}
        {displayUserInfo.length > 0 && (
          <div className="mb-4 flex justify-center gap-2">
            {displayUserInfo.map((user, idx) => (
              <div key={user.userId} className="flex flex-col items-center">
                <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors ${currentIndex === idx ? "bg-primary bg-blue-100" : "bg-muted text-muted-foreground"}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`ページ${idx + 1}`}
                >
                  {idx + 1}
                </button>
                <div className="flex h-5 items-center justify-center">
                  {user.hasReviewed && (
                    <CheckCircle
                      className="mt-1 h-4 w-4 rounded-full bg-green-100 text-green-500"
                      data-testid="check-circle-icon"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="relative mx-auto w-full max-w-xl">
          <Carousel>
            <CarouselContent style={{ transform: `translateX(-${currentIndex * 100}%)`, transition: "transform 0.3s" }}>
              {isLoadingDisplayUserInfo ? (
                <CarouselItem>
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" data-testid="loading-spinner" />
                  </div>
                </CarouselItem>
              ) : displayUserInfo.length === 0 ? (
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
            {displayUserInfo.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((prev) => (prev - 1 + displayUserInfo.length) % displayUserInfo.length)
                  }
                  className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full border bg-white p-2 shadow"
                  aria-label="前へ"
                >
                  {/* ← */}
                  <span className="text-lg">&#8592;</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % displayUserInfo.length)}
                  className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full border bg-white p-2 shadow"
                  aria-label="次へ"
                >
                  {/* → */}
                  <span className="text-lg">&#8594;</span>
                </button>
              </>
            )}
          </Carousel>
        </div>
      </CardContent>
    </Card>
  );
});
