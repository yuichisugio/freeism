"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/app/actions/task";
import { CustomFormField } from "@/components/share/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { ImageUploadArea } from "@/components/ui/image-upload-area";
import { AUCTION_CATEGORIES } from "@/lib/auction/constants";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type User = {
  id: string;
  name: string;
};

// タスク実行者または報告者の型定義
type TaskParticipant = {
  userId?: string;
  name?: string;
};

// タスクの型定義
type Task = {
  id: string;
  task: string;
  detail: string | null;
  reference: string | null;
  info: string | null;
  imageUrl: string | null;
  status: string;
  contributionType: contributionType;
  category?: string;
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    id: string;
    name: string;
  };
};

const formSchema = taskFormSchema.extend({
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

type TaskEditModalProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  task: Task | null;
  users?: User[];
  onTaskUpdated?: () => void;
};

export function TaskEditModal({ open, onOpenChangeAction, task, users = [], onTaskUpdated }: TaskEditModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      category: "その他",
      executors: [],
      reporters: [],
      imageUrl: "",
    },
  });

  // 現在選択されている貢献タイプを監視
  const selectedContributionType = form.watch("contributionType");
  const isRewardType = selectedContributionType === contributionType.REWARD;

  // タスクデータが変更されたときにフォームをリセット
  useEffect(() => {
    if (task) {
      form.reset({
        task: task.task,
        detail: task.detail || "",
        reference: task.reference || "",
        info: task.info || "",
        imageUrl: task.imageUrl || "",
        contributionType: task.contributionType,
        category: task.category || "その他",
      });

      // 実行者と報告者をセット
      setExecutors(task.executors || []);
      setReporters(task.reporters || []);
    }
  }, [task, form]);

  // 実行者を追加する関数
  const addExecutor = (userId?: string, name?: string) => {
    if (userId) {
      // 登録済みユーザーの場合
      const user = users.find((u) => u.id === userId);
      if (user && !executors.some((e) => e.userId === userId)) {
        const newExecutors = [...executors, { userId, name: user.name }];
        setExecutors(newExecutors);
      }
    } else if (name && name.trim() !== "") {
      // 未登録ユーザーの場合
      const newExecutors = [...executors, { name }];
      setExecutors(newExecutors);
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
      }
    } else if (name && name.trim() !== "") {
      // 未登録ユーザーの場合
      const newReporters = [...reporters, { name }];
      setReporters(newReporters);
      setNonRegisteredReporter("");
    }
  };

  // 実行者を削除する関数
  const removeExecutor = (index: number) => {
    const newExecutors = executors.filter((_, i) => i !== index);
    setExecutors(newExecutors);
  };

  // 報告者を削除する関数
  const removeReporter = (index: number) => {
    const newReporters = reporters.filter((_, i) => i !== index);
    setReporters(newReporters);
  };

  // 画像アップロード完了時のハンドラー
  const handleImageUploaded = (imageUrl: string) => {
    form.setValue("imageUrl", imageUrl);
  };

  // 画像削除時のハンドラー
  const handleImageRemoved = () => {
    form.setValue("imageUrl", "");
  };

  // 更新を実行する関数（フォーム送信の代わりに直接呼び出す）
  const handleUpdate = async () => {
    if (!task) {
      console.error("タスクが存在しません");
      return;
    }

    // フォームのバリデーション
    const isValid = await form.trigger();
    if (!isValid) {
      console.error("フォームバリデーションエラー:", form.formState.errors);
      return;
    }

    const formData = form.getValues();
    console.log("更新データ:", formData);
    console.log("executors:", executors);
    console.log("reporters:", reporters);

    setIsSubmitting(true);
    toast.loading("タスクを更新中...");

    try {
      // タスクを更新
      const result = await updateTask(task.id, {
        task: formData.task,
        detail: formData.detail,
        reference: formData.reference,
        info: formData.info,
        imageUrl: formData.imageUrl,
        contributionType: formData.contributionType,
        category: formData.category,
        executors: executors,
        reporters: reporters,
      });

      console.log("更新結果:", result);
      toast.dismiss();

      if (result && result.success) {
        toast.success("タスクを更新しました");

        // モーダルを閉じる
        onOpenChangeAction(false);

        // データの更新を親コンポーネントに通知
        if (onTaskUpdated) {
          onTaskUpdated();
        }

        // Next.jsのルーターキャッシュを更新
        router.refresh();

        // 追加：リアルタイム更新を促進するため、URLに小さな変更を加えて戻す
        // これにより、Next.jsのクライアントサイドナビゲーションが強制的に発生
        const currentPath = window.location.pathname;
        const hasQuery = window.location.search.length > 0;
        const refreshParam = `_t=${Date.now()}`;

        const newPath = hasQuery ? `${currentPath}${window.location.search}&${refreshParam}` : `${currentPath}?${refreshParam}`;

        // URLを一時的に変更して元に戻す（画面のチラつきを防ぐため遅延実行）
        setTimeout(() => {
          router.replace(newPath);
          setTimeout(() => {
            router.replace(currentPath + (window.location.search || ""));
          }, 100);
        }, 100);
      } else {
        const errorMessage = result?.error || "タスクの更新に失敗しました（不明なエラー）";
        toast.error(errorMessage);
        console.error("更新失敗:", result);
      }
    } catch (error) {
      console.error("タスク更新エラー:", error);
      toast.dismiss();
      toast.error("タスクの更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isSubmitting) {
          onOpenChangeAction(isOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
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

            {/* 報酬になる貢献の場合のみ画像アップロードを表示 */}
            {isRewardType && (
              <div className="space-y-2">
                <label className="text-sm font-medium">報酬画像</label>
                <p className="text-sm text-gray-500">報酬として提供する商品・サービスの画像をアップロードしてください</p>
                <ImageUploadArea onImageUploaded={handleImageUploaded} onImageRemoved={handleImageRemoved} initialImageUrl={form.getValues("imageUrl")} />
              </div>
            )}

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
              open={categoryOpen}
              setOpen={setCategoryOpen}
              options={AUCTION_CATEGORIES.slice(1).map((category) => ({ id: category, name: category }))}
              placeholder="カテゴリを選択してください"
            />

            <CustomFormField fieldType="textarea" control={form.control} name="detail" label="タスクの詳細" description="タスクの詳細を入力してください" placeholder="タスクの詳細を入力してください" />

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
                          {executor.name || "名前なし"} {executor.userId ? "(登録済み)" : "(未登録)"}
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
                          {reporter.name || "名前なし"} {reporter.userId ? "(登録済み)" : "(未登録)"}
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
}
