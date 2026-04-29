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
 * サーバーとクライアントで一貫した日付フォーマットを提供する関数
 */
function formatDateConsistent(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * コメントの改行を反映して表示するコンポーネント
 */
const FormattedComment = memo(function FormattedComment({ comment }: { comment: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="leading-relaxed break-words whitespace-pre-wrap text-gray-800">{comment}</div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統合されたレビューカードコンポーネント
 * editableプロパティで編集可能性を制御
 */
export const ReviewCard = memo(function ReviewCard({
  review,
  showReviewer = false,
  editable = false,
  onToggleEdit,
  onUpdateReview,
  isUpdating,
  isMounted = true,
}: {
  review: EditableReviewData | ReviewData;
  showReviewer?: boolean;
  editable?: boolean;
  onToggleEdit?: (reviewId: string) => void;
  onUpdateReview?: (params: { reviewId: string; rating: number; comment: string | null }) => void;
  isLoading?: boolean;
  isUpdating?: boolean;
  isMounted?: boolean;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集用の評価とコメント（編集可能な場合のみ使用）
   */
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集可能なレビューかどうかを判定
   */
  const isEditableReview = useMemo(
    () =>
      (review: EditableReviewData | ReviewData): review is EditableReviewData =>
        editable && "isEditing" in review,
    [editable],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在編集モードかどうか（Hydration対策：マウント後のみ適用）
   */
  const isEditing = useMemo(
    () => (isMounted && isEditableReview(review) ? review.isEditing : false),
    [isMounted, isEditableReview, review],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集モードが変更された時に初期値をリセット（編集可能な場合のみ）
   */
  useEffect(() => {
    if (editable && isEditing) {
      setEditRating(review.rating);
      setEditComment(review.comment ?? "");
    }
  }, [editable, isEditing, review.rating, review.comment]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 保存ボタンのハンドラー
   */
  const handleSave = useCallback(() => {
    if (onUpdateReview) {
      onUpdateReview({ reviewId: review.id, rating: editRating, comment: editComment.trim() || null });
    }
  }, [review.id, editRating, editComment, onUpdateReview]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャンセルボタンのハンドラー
   */
  const handleCancel = useCallback(() => {
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    if (onToggleEdit) {
      onToggleEdit(review.id);
    }
  }, [review.id, review.rating, review.comment, onToggleEdit]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 星評価の表示コンポーネント
   */
  const renderStarRating = useCallback(() => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <RatingStar rating={editRating} readonly={false} onChange={setEditRating} size={20} />
          <span className="font-medium">{editRating}.0</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
            />
          ))}
          <span className="ml-2 font-medium">{review.rating}.0</span>
        </div>
      );
    }
  }, [isEditing, review.rating, editRating]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 編集ボタンの表示コンポーネント
   */
  const renderEditButtons = useCallback(() => {
    if (!editable || !onToggleEdit || !isMounted) return null;

    if (isEditing) {
      return (
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
      );
    } else {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onToggleEdit(review.id)}
          className="h-8 w-8 border-blue-300 p-0 text-blue-600 hover:bg-blue-50"
        >
          <Edit className="h-4 w-4" />
        </Button>
      );
    }
  }, [editable, isEditing, onToggleEdit, review.id, isUpdating, handleSave, handleCancel, isMounted]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コメント表示/編集コンポーネント
   */
  const renderComment = useCallback(() => {
    if (isEditing) {
      return (
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
      );
    } else {
      return review.comment && <FormattedComment comment={review.comment} />;
    }
  }, [isEditing, review.id, review.comment, editComment, setEditComment]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Hydration対策：初期レンダリング時は簡単な表示にする
   */
  if (!isMounted) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-4 w-1/4 rounded bg-gray-200"></div>
            <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            <div className="h-16 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
              {renderStarRating()}

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
                  {formatDateConsistent(review.createdAt)}
                  <span className="ml-2 text-xs text-blue-600">(更新: {formatDateConsistent(review.updatedAt)})</span>
                </span>
              </div>

              {/* 編集ボタン */}
              {renderEditButtons()}
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
          {renderComment()}

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
