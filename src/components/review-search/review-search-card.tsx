"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { RatingStar } from "@/components/auction/common/rating-star";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Edit, Hash, Package, Save, Star, Users, X } from "lucide-react";

import type { EditableReviewData, ReviewData } from "./review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 編集可能なレビューカードコンポーネント
 */
export const EditableReviewCard = memo(function EditableReviewCard({
  review,
  onToggleEdit,
  onUpdateReview,
  isUpdating,
}: {
  review: EditableReviewData;
  onToggleEdit: (reviewId: string) => void;
  onUpdateReview: (reviewId: string, rating: number, comment: string | null) => void;
  isUpdating: boolean;
}) {
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");

  // 編集モードが変更された時に初期値をリセット
  useEffect(() => {
    if (review.isEditing) {
      setEditRating(review.rating);
      setEditComment(review.comment ?? "");
    }
  }, [review.isEditing, review.rating, review.comment]);

  const handleSave = useCallback(() => {
    onUpdateReview(review.id, editRating, editComment.trim() || null);
  }, [review.id, editRating, editComment, onUpdateReview]);

  const handleCancel = useCallback(() => {
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    onToggleEdit(review.id);
  }, [review.id, review.rating, review.comment, onToggleEdit]);

  const isUpdated = useMemo(
    () => review.updatedAt.getTime() !== review.createdAt.getTime(),
    [review.updatedAt, review.createdAt],
  );

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* レビュー評価と日付 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 星評価表示 */}
              {review.isEditing ? (
                <div className="flex items-center gap-2">
                  <RatingStar rating={editRating} readonly={false} onChange={setEditRating} size={20} />
                  <span className="font-medium">{editRating}.0</span>
                </div>
              ) : (
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{review.rating}.0</span>
                </div>
              )}

              {/* レビューの立場を示すバッジ */}
              <Badge variant="secondary" className="text-xs">
                {review.reviewPosition === "SELLER_TO_BUYER" ? "売り手から" : "買い手から"}
              </Badge>
            </div>

            {/* 日付表示と編集ボタン */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {review.createdAt.toLocaleDateString("ja-JP")}
                  {isUpdated && (
                    <span className="ml-2 text-xs text-blue-600">
                      (更新: {review.updatedAt.toLocaleDateString("ja-JP")})
                    </span>
                  )}
                </span>
              </div>

              {/* 編集ボタン */}
              {review.isEditing ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="h-8 w-8 bg-green-600 p-0 text-white hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="h-8 w-8 border-gray-300 p-0 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleEdit(review.id)}
                  className="h-8 w-8 border-blue-300 p-0 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {/* レビュー受信者（誰宛へのレビューか） */}
            {review.reviewee && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>宛先: {review.reviewee?.username ?? "未設定"}</span>
              </div>
            )}
          </div>

          {/* レビューコメント */}
          {review.isEditing ? (
            <div className="space-y-2">
              <label htmlFor={`comment-${review.id}`} className="text-sm font-medium">
                コメント
              </label>
              <Textarea
                id={`comment-${review.id}`}
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                placeholder="レビューコメントを入力してください..."
                className="min-h-[100px]"
              />
            </div>
          ) : (
            review.comment && (
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="leading-relaxed text-gray-800">{review.comment}</p>
              </div>
            )
          )}

          {/* 関連情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>タスク: {review.auction.task.task.substring(0, 50)}...</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>グループ: {review.auction.task.group.name}</span>
            </div>
            {review.auction.task.category && (
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>カテゴリ: {review.auction.task.category}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 個別レビューを表示するカードコンポーネント
 */
export const ReviewCard = memo(function ReviewCard({
  review,
  showReviewer = false,
}: {
  review: ReviewData;
  showReviewer?: boolean;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューカードのメインコンポーネント
   */
  // 更新日時を表示するかどうかの判定
  const isUpdated = review.updatedAt.getTime() !== review.createdAt.getTime();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューカードのメインコンポーネント
   */
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* レビュー評価と日付 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 星評価表示 */}
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                ))}
              </div>
              <span className="font-medium">{review.rating}.0</span>
              {/* レビューの立場を示すバッジ */}
              <Badge variant="secondary" className="text-xs">
                {review.reviewPosition === "SELLER_TO_BUYER" ? "売り手から" : "買い手から"}
              </Badge>
            </div>

            {/* 日付表示 */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {review.createdAt.toLocaleDateString("ja-JP")}
                {isUpdated && (
                  <span className="ml-2 text-xs text-blue-600">
                    (更新: {review.updatedAt.toLocaleDateString("ja-JP")})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {/* レビュー受信者（誰宛へのレビューか） */}
            {review.reviewee && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>宛先: {review.reviewee?.username ?? "未設定"}</span>
              </div>
            )}
            {/* レビュー送信者（自身へのレビュータブでのみ表示） */}
            {showReviewer && review.reviewer && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>送信者: {review.reviewer?.username ?? "未設定"}</span>
              </div>
            )}
          </div>

          {/* レビューコメント */}
          {review.comment && (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="leading-relaxed text-gray-800">{review.comment}</p>
            </div>
          )}

          {/* 関連情報 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>タスク: {review.auction.task.task.substring(0, 50)}...</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>グループ: {review.auction.task.group.name}</span>
            </div>
            {review.auction.task.category && (
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>カテゴリ: {review.auction.task.category}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
