"use client";

import type { TaskFormValues, User } from "@/hooks/modal/use-task-edit-modal";
import type { EditableTask } from "@/hooks/table/use-task-editor";
import type { Task } from "@/types/group";
import type { Control } from "react-hook-form";
import { memo } from "react";
import { CustomFormField } from "@/components/share/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { ImageUploadArea } from "@/components/ui/image-upload-area";
import { useTaskEditModal } from "@/hooks/modal/use-task-edit-modal";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク編集モーダルの型
 */
type TaskEditModalProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  task: Task | EditableTask | null;
  users?: User[];
  onTaskUpdated?: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク編集モーダル
 * @param open モーダルの表示状態
 * @param onOpenChangeAction モーダルの表示状態を変更するアクション
 * @param task タスク
 * @param users ユーザー
 * @param onTaskUpdated タスク更新時のコールバック
 * @returns タスク編集モーダル
 */
export const TaskEditModal = memo(function TaskEditModal({
  open,
  onOpenChangeAction,
  task,
  users = [],
  onTaskUpdated,
}: TaskEditModalProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useTaskEditModal フックからの返り値を適切に型付けする
  const {
    form,
    isSubmitting,
    isRewardType,
    categoryOpen,
    setCategoryOpen,
    executors,
    nonRegisteredExecutor,
    setNonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    setNonRegisteredReporter,
    handleOpenChange,
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    handleUpdate,
  } = useTaskEditModal({ open, onOpenChangeAction, task, users, onTaskUpdated });

  // 型キャストをtypeスクリプトに合わせて修正
  const typedControl = form.control as Control<TaskFormValues>;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
            <CustomFormField
              fieldType="radio"
              control={typedControl}
              name="contributionType"
              label="貢献の種類"
              options={[
                { value: contributionType.REWARD, label: "報酬になる貢献" },
                { value: contributionType.NON_REWARD, label: "報酬にならない貢献" },
              ]}
            />

            {/* 報酬になる貢献の場合のみ画像アップロードを表示 */}
            {isRewardType && (
              <div className="space-y-2" role="group" aria-label="報酬画像">
                <p className="text-sm font-medium">報酬画像</p>
                <p className="text-sm text-gray-500">報酬として提供する商品・サービスの画像をアップロードしてください</p>
                <ImageUploadArea
                  onImageUploaded={handleImageUploaded}
                  onImageRemoved={handleImageRemoved}
                  initialImageUrl={form.getValues("imageUrl")}
                />
              </div>
            )}

            <CustomFormField
              fieldType="input"
              type="text"
              control={typedControl}
              name="task"
              label="タスクのタイトル"
              description="タスクのタイトルを入力してください"
              placeholder="タスクのタイトルを入力してください"
            />

            {/* カテゴリ選択を追加 */}
            <CustomFormField
              fieldType="combobox"
              control={typedControl}
              name="category"
              label="カテゴリ"
              description="タスクのカテゴリを選択してください"
              open={categoryOpen}
              setOpen={setCategoryOpen}
              options={AUCTION_CONSTANTS.AUCTION_CATEGORIES.slice(1).map((category) => ({
                id: category,
                name: category,
              }))}
              placeholder="カテゴリを選択してください"
            />

            <CustomFormField
              fieldType="textarea"
              control={typedControl}
              name="detail"
              label="タスクの詳細"
              description="タスクの詳細を入力してください"
              placeholder="タスクの詳細を入力してください"
            />

            <CustomFormField
              fieldType="textarea"
              control={typedControl}
              name="reference"
              label="参考にした内容"
              description="タスクを実行する際に参考にした情報があれば記載してください"
              placeholder="参考にした内容を入力してください"
            />

            <CustomFormField
              fieldType="textarea"
              control={typedControl}
              name="info"
              label="証拠・結果・補足情報"
              description="貢献度を評価するための証拠や結果、補足情報（プルリクURL等）を記載してください"
              placeholder="証拠・結果・補足情報を入力してください"
            />

            {/* タスク実行者セクション */}
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="text-lg font-medium">タスク実行者</h3>
              <p className="text-sm text-gray-500">このタスクを実行した人を選択または入力してください</p>

              {/* 登録済みユーザー選択 */}
              {users.length > 0 && (
                <div className="flex gap-2">
                  <select className="flex-1 rounded-md border p-2" onChange={(e) => e.target.value && addExecutor(e.target.value)} value="">
                    <option value="">登録済みユーザーから選択...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 未登録ユーザー入力 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border p-2"
                  placeholder="未登録ユーザー名を入力..."
                  value={nonRegisteredExecutor}
                  onChange={(e) => setNonRegisteredExecutor(e.target.value)}
                />
                <Button
                  type="button"
                  className="bg-blue-500 text-white"
                  onClick={() => {
                    if (nonRegisteredExecutor.trim()) {
                      addExecutor(undefined, nonRegisteredExecutor);
                    }
                  }}
                >
                  追加
                </Button>
              </div>

              {/* 選択された実行者のリスト */}
              {executors.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium">選択された実行者:</h4>
                  <ul className="mt-1 space-y-1">
                    {executors.map((executor, index) => (
                      <li key={`executor-${index}`} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                        <span>
                          {executor.name ?? "名前なし"} {executor.userId ? "(登録済み)" : "(未登録)"}
                        </span>
                        <Button type="button" variant="ghost" className="h-auto p-1 text-red-500" onClick={() => removeExecutor(index)}>
                          削除
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* タスク報告者セクション */}
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="text-lg font-medium">タスク報告者</h3>
              <p className="text-sm text-gray-500">このタスクを報告した人を選択または入力してください</p>

              {/* 登録済みユーザー選択 */}
              {users.length > 0 && (
                <div className="flex gap-2">
                  <select className="flex-1 rounded-md border p-2" onChange={(e) => e.target.value && addReporter(e.target.value)} value="">
                    <option value="">登録済みユーザーから選択...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 未登録ユーザー入力 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border p-2"
                  placeholder="未登録ユーザー名を入力..."
                  value={nonRegisteredReporter}
                  onChange={(e) => setNonRegisteredReporter(e.target.value)}
                />
                <Button
                  type="button"
                  className="bg-blue-500 text-white"
                  onClick={() => {
                    if (nonRegisteredReporter.trim()) {
                      addReporter(undefined, nonRegisteredReporter);
                    }
                  }}
                >
                  追加
                </Button>
              </div>

              {/* 選択された報告者のリスト */}
              {reporters.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium">選択された報告者:</h4>
                  <ul className="mt-1 space-y-1">
                    {reporters.map((reporter, index) => (
                      <li key={`reporter-${index}`} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                        <span>
                          {reporter.name ?? "名前なし"} {reporter.userId ? "(登録済み)" : "(未登録)"}
                        </span>
                        <Button type="button" variant="ghost" className="h-auto p-1 text-red-500" onClick={() => removeReporter(index)}>
                          削除
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 送信ボタン */}
            <div className="flex justify-end space-x-4 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChangeAction(false)} disabled={isSubmitting}>
                キャンセル
              </Button>
              <Button type="button" className="button-default-custom" disabled={isSubmitting} onClick={handleUpdate}>
                {isSubmitting ? "更新中..." : "更新"}
              </Button>
            </div>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
