"use client";

import type { Control, FieldValues, UseFormReturn } from "react-hook-form";
import { memo } from "react";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { Loading } from "@/components/share/loading";
import { ImageUploadArea } from "@/components/ui/image-upload-area";
import { useTaskInputForm } from "@/hooks/form/use-create-task-form";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク入力フォーム
 */
export const CreateTaskForm = memo(function CreateTaskForm(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックからロジックを取得
   */
  const {
    // state
    groups,
    users,
    form,
    open,
    categoryOpen,
    executors,
    nonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    isRewardType,
    isLoading,

    // function
    setCategoryOpen,
    setNonRegisteredExecutor,
    setOpen,
    setNonRegisteredReporter,
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    onSubmit,
  } = useTaskInputForm();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 型安全性のため form の型を明示的に指定
   */
  const typedControl = form.control as unknown as Control<FieldValues>;
  const typedExecutors = executors;
  const typedReporters = reporters;
  const typedGetValues = form.getValues;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * FormLayoutに渡すための型変換
   */
  const typedForm = form as unknown as UseFormReturn<FieldValues>;
  const typedOnSubmit = onSubmit as (data: FieldValues) => Promise<void>;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中の場合の処理を追加
   */
  if (isLoading) {
    return <Loading />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク入力フォーム
   */
  return (
    <FormLayout form={typedForm} onSubmit={typedOnSubmit} submitLabel="保存" submittingLabel="保存中...">
      {/* グループ選択が必要な場合 */}
      <CustomFormField
        open={open}
        setOpen={setOpen}
        fieldType="combobox"
        control={typedControl}
        name="groupId"
        label="グループ選択"
        description="タスクを登録するグループを選択してください"
        options={groups}
        placeholder="グループを選択してください"
        searchPlaceholder="グループを検索..."
        emptyMessage="グループに参加して下さい。"
      />

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
        options={AUCTION_CONSTANTS.AUCTION_CATEGORIES.slice(1).map((category) => ({ id: category, name: category }))}
        placeholder="カテゴリを選択してください"
        open={categoryOpen}
        setOpen={setCategoryOpen}
      />

      <CustomFormField
        fieldType="textarea"
        control={typedControl}
        name="detail"
        label="タスクの詳細"
        description="具体的な行動内容を記載してください"
        placeholder="タスクの内容を入力してください"
      />

      {/* 報酬になる貢献の場合のみ画像アップロードを表示 */}
      {isRewardType && (
        <div className="space-y-2" role="group" aria-label="報酬画像">
          <p className="form-label-custom text-base font-medium text-gray-700">報酬画像</p>
          <p className="form-description-custom text-sm text-gray-500">報酬として提供する商品・サービスの画像をアップロードしてください</p>
          <ImageUploadArea onImageUploaded={handleImageUploaded} onImageRemoved={handleImageRemoved} initialImageUrl={typedGetValues("imageUrl")} />
        </div>
      )}

      {/* 報酬になる貢献の場合のみオークション関連設定を表示 */}
      {isRewardType && (
        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-lg font-medium">オークション設定</h3>

          {/* オークション開始日時 - CustomFormFieldを使用 */}
          <CustomFormField
            fieldType="date"
            control={typedControl}
            name="auctionStartTime"
            label="オークション開始日時"
            description="オークションの開始日時を設定してください。未設定の場合は現在の日時が適用されます。"
            dateFormat="yyyy年MM月dd日"
            placeholder="開始日時を選択"
          />

          {/* オークション終了日時 - CustomFormFieldを使用 */}
          <CustomFormField
            fieldType="date"
            control={typedControl}
            name="auctionEndTime"
            label="オークション終了日時"
            description="オークションの終了日時を設定してください。未設定の場合は開始から1週間後が適用されます。"
            dateFormat="yyyy年MM月dd日"
            placeholder="終了日時を選択"
          />

          {/* 提供方法 */}
          <CustomFormField
            fieldType="textarea"
            control={typedControl}
            name="deliveryMethod"
            label="提供方法"
            description="商品・サービスの提供方法を記載してください（例：Amazonほしい物リスト、Githubリポジトリ共有など）"
            placeholder="提供方法を入力してください"
          />
        </div>
      )}

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
          <button type="button" className="rounded-md bg-blue-500 px-4 py-2 text-white" onClick={() => addExecutor(undefined, nonRegisteredExecutor)}>
            追加
          </button>
        </div>

        {/* 選択された実行者のリスト */}
        {typedExecutors.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-medium">選択された実行者:</h4>
            <ul className="mt-1 space-y-1">
              {typedExecutors.map((executor, index) => (
                <li key={index} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                  <span>
                    {executor.name ?? "名前なし"} {executor.userId ? "(登録済み)" : "(未登録)"}
                  </span>
                  <button type="button" className="text-red-500" onClick={() => removeExecutor(index)}>
                    削除
                  </button>
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
          <button type="button" className="rounded-md bg-blue-500 px-4 py-2 text-white" onClick={() => addReporter(undefined, nonRegisteredReporter)}>
            追加
          </button>
        </div>

        {/* 選択された報告者のリスト */}
        {typedReporters.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-medium">選択された報告者:</h4>
            <ul className="mt-1 space-y-1">
              {typedReporters.map((reporter, index) => (
                <li key={index} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                  <span>
                    {reporter.name ?? "名前なし"} {reporter.userId ? "(登録済み)" : "(未登録)"}
                  </span>
                  <button type="button" className="text-red-500" onClick={() => removeReporter(index)}>
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FormLayout>
  );
});
