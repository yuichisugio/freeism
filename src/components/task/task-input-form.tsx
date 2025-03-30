"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions/task";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { ImageUploadArea } from "@/components/ui/image-upload-area";
import { AUCTION_CATEGORIES } from "@/lib/auction/constants";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Group = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
};

// タスク実行者または報告者の型定義
type TaskParticipant = {
  userId?: string;
  name?: string;
};

const formSchema = taskFormSchema.extend({
  groupId: z.string({
    required_error: "グループに参加して下さい。",
  }),
  // カテゴリを追加
  category: z.string().optional(),
  // 実行者の配列（オプション）
  executors: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  // 報告者の配列（オプション）
  reporters: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  // 画像URL
  imageUrl: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof formSchema>;

export type TaskFormValuesAndGroupId = TaskFormValues & {
  groupId: string;
};

export function TaskInputForm({
  groups,
  groupComboBoxFlag,
  users = [], // デフォルト値を空配列に設定
}: {
  groups: Group[];
  groupComboBoxFlag: boolean;
  users?: User[]; // オプショナルにする
}) {
  // ルーター
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [executors, setExecutors] = useState<TaskParticipant[]>([]);
  const [nonRegisteredExecutor, setNonRegisteredExecutor] = useState("");
  const [reporters, setReporters] = useState<TaskParticipant[]>([]);
  const [nonRegisteredReporter, setNonRegisteredReporter] = useState("");

  // フォーム
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task: "",
      detail: "",
      reference: "",
      info: "",
      contributionType: contributionType.REWARD,
      category: "その他", // デフォルト値を設定
      executors: [],
      reporters: [],
      imageUrl: "",
      auctionStartTime: new Date(),
      auctionEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryMethod: "",
    },
  });

  // 現在選択されている貢献タイプ
  const selectedContributionType = form.watch("contributionType");
  const isRewardType = selectedContributionType === contributionType.REWARD;

  // 実行者を追加する関数
  const addExecutor = (userId?: string, name?: string) => {
    if (userId) {
      // 登録済みユーザーの場合
      const user = users.find((u) => u.id === userId);
      if (user && !executors.some((e) => e.userId === userId)) {
        const newExecutors = [...executors, { userId, name: user.name }];
        setExecutors(newExecutors);
        form.setValue("executors", newExecutors);
      }
    } else if (name && name.trim() !== "") {
      // 未登録ユーザーの場合
      const newExecutors = [...executors, { name }];
      setExecutors(newExecutors);
      form.setValue("executors", newExecutors);
      setNonRegisteredExecutor("");
    }
  };

  // 報告者を追加する関数
  const addReporter = (userId?: string, name?: string) => {
    if (userId) {
      // 登録済みユーザーの場合
      const user = users.find((u) => u.id === userId);
      if (user && !reporters.some((r) => r.userId === userId)) {
        const newReporters = [...reporters, { userId, name: user.name }];
        setReporters(newReporters);
        form.setValue("reporters", newReporters);
      }
    } else if (name && name.trim() !== "") {
      // 未登録ユーザーの場合
      const newReporters = [...reporters, { name }];
      setReporters(newReporters);
      form.setValue("reporters", newReporters);
      setNonRegisteredReporter("");
    }
  };

  // 実行者を削除する関数
  const removeExecutor = (index: number) => {
    const newExecutors = executors.filter((_, i) => i !== index);
    setExecutors(newExecutors);
    form.setValue("executors", newExecutors);
  };

  // 報告者を削除する関数
  const removeReporter = (index: number) => {
    const newReporters = reporters.filter((_, i) => i !== index);
    setReporters(newReporters);
    form.setValue("reporters", newReporters);
  };

  // 画像アップロード完了時のハンドラー
  const handleImageUploaded = (imageUrl: string) => {
    form.setValue("imageUrl", imageUrl);
  };

  // 画像削除時のハンドラー
  const handleImageRemoved = () => {
    form.setValue("imageUrl", "");
  };

  // フォーム送信
  async function onSubmit(data: TaskFormValues) {
    console.log("フォーム送信データ:", data);

    try {
      // タスクを保存
      const result = await createTask({
        task: data.task,
        detail: data.detail,
        reference: data.reference,
        info: data.info,
        imageUrl: data.imageUrl,
        contributionType: data.contributionType,
        category: data.category, // カテゴリを追加
        groupId: data.groupId,
        executors: executors.length > 0 ? executors : undefined,
        reporters: reporters.length > 0 ? reporters : undefined,
        // オークション関連のデータを追加
        auctionStartTime: data.contributionType === contributionType.REWARD ? data.auctionStartTime : undefined,
        auctionEndTime: data.contributionType === contributionType.REWARD ? data.auctionEndTime : undefined,
        deliveryMethod: data.contributionType === contributionType.REWARD ? data.deliveryMethod : undefined,
      });

      if (result.success) {
        toast.success("タスクを保存しました");
        router.push(result.task.groupId ? `/dashboard/group/${result.task.groupId}` : "/dashboard/my-tasks");
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("フォーム送信エラー:", error);
      toast.error("タスクの保存に失敗しました");
    }
  }

  return (
    <FormLayout form={form} onSubmit={onSubmit} submitLabel="保存" submittingLabel="保存中...">
      {/* グループ選択が必要な場合 */}
      {groupComboBoxFlag && (
        <CustomFormField
          open={open}
          setOpen={setOpen}
          fieldType="combobox"
          control={form.control}
          name="groupId"
          label="グループ選択"
          description="タスクを登録するグループを選択してください"
          options={groups}
          placeholder="グループを選択してください"
          searchPlaceholder="グループを検索..."
          emptyMessage="グループに参加して下さい。"
        />
      )}

      <CustomFormField
        fieldType="radio"
        control={form.control}
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
        control={form.control}
        name="task"
        label="タスクのタイトル"
        description="タスクのタイトルを入力してください"
        placeholder="タスクのタイトルを入力してください"
      />

      {/* カテゴリ選択を追加 */}
      <CustomFormField
        fieldType="combobox"
        control={form.control}
        name="category"
        label="カテゴリ"
        description="タスクのカテゴリを選択してください"
        options={AUCTION_CATEGORIES.slice(1).map((category) => ({ id: category, name: category }))}
        placeholder="カテゴリを選択してください"
        open={categoryOpen}
        setOpen={setCategoryOpen}
      />

      <CustomFormField fieldType="textarea" control={form.control} name="detail" label="タスクの詳細" description="具体的な行動内容を記載してください" placeholder="タスクの内容を入力してください" />

      {/* 報酬になる貢献の場合のみ画像アップロードを表示 */}
      {isRewardType && (
        <div className="space-y-2">
          <label className="form-label-custom text-base font-medium text-gray-700">報酬画像</label>
          <p className="form-description-custom text-sm text-gray-500">報酬として提供する商品・サービスの画像をアップロードしてください</p>
          <ImageUploadArea onImageUploaded={handleImageUploaded} onImageRemoved={handleImageRemoved} initialImageUrl={form.getValues("imageUrl")} />
        </div>
      )}

      {/* 報酬になる貢献の場合のみオークション関連設定を表示 */}
      {isRewardType && (
        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-lg font-medium">オークション設定</h3>

          {/* オークション開始日時 - CustomFormFieldを使用 */}
          <CustomFormField
            fieldType="date"
            control={form.control}
            name="auctionStartTime"
            label="オークション開始日時"
            description="オークションの開始日時を設定してください。未設定の場合は現在の日時が適用されます。"
            dateFormat="yyyy年MM月dd日 HH:mm"
            placeholder="開始日時を選択"
          />

          {/* オークション終了日時 - CustomFormFieldを使用 */}
          <CustomFormField
            fieldType="date"
            control={form.control}
            name="auctionEndTime"
            label="オークション終了日時"
            description="オークションの終了日時を設定してください。未設定の場合は開始から1週間後が適用されます。"
            dateFormat="yyyy年MM月dd日 HH:mm"
            placeholder="終了日時を選択"
          />

          {/* 提供方法 */}
          <CustomFormField
            fieldType="textarea"
            control={form.control}
            name="deliveryMethod"
            label="提供方法"
            description="商品・サービスの提供方法を記載してください（例：Amazonほしい物リスト、Githubリポジトリ共有など）"
            placeholder="提供方法を入力してください"
          />
        </div>
      )}

      <CustomFormField
        fieldType="textarea"
        control={form.control}
        name="reference"
        label="参考にした内容"
        description="タスクを実行する際に参考にした情報があれば記載してください"
        placeholder="参考にした内容を入力してください"
      />

      <CustomFormField
        fieldType="textarea"
        control={form.control}
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
        {executors.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-medium">選択された実行者:</h4>
            <ul className="mt-1 space-y-1">
              {executors.map((executor, index) => (
                <li key={index} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                  <span>
                    {executor.name || "名前なし"} {executor.userId ? "(登録済み)" : "(未登録)"}
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
        {reporters.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-medium">選択された報告者:</h4>
            <ul className="mt-1 space-y-1">
              {reporters.map((reporter, index) => (
                <li key={index} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1">
                  <span>
                    {reporter.name || "名前なし"} {reporter.userId ? "(登録済み)" : "(未登録)"}
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
}
