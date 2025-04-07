"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/actions/task";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// 型定義
export type Group = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  name: string;
};

// タスク実行者または報告者の型定義
export type TaskParticipant = {
  userId?: string;
  name?: string;
};

// フォームスキーマの拡張
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

// カスタムフック
export function useTaskInputForm({
  users = [], // デフォルト値を空配列に設定
}: {
  groups: Group[];
  users?: User[]; // オプショナルにする
}) {
  // ルーター
  const router = useRouter();

  // 状態管理
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

  return {
    form,
    open,
    setOpen,
    categoryOpen,
    setCategoryOpen,
    executors,
    nonRegisteredExecutor,
    setNonRegisteredExecutor,
    reporters,
    nonRegisteredReporter,
    setNonRegisteredReporter,
    isRewardType,
    addExecutor,
    removeExecutor,
    addReporter,
    removeReporter,
    handleImageUploaded,
    handleImageRemoved,
    onSubmit,
  };
}
