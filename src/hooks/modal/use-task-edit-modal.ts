import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/lib/actions/task";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { contributionType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// 型定義
export type User = {
  id: string;
  name: string;
};

export type TaskParticipant = {
  userId?: string;
  name?: string;
};

export type Task = {
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

// フォームスキーマ
const formSchema = taskFormSchema.extend({
  category: z.string().optional(),
  executors: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  reporters: z
    .array(
      z.object({
        userId: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  imageUrl: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof formSchema>;

// カスタムフックの引数
export type UseTaskEditModalProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  task: Task | null;
  users?: User[];
  onTaskUpdated?: () => void;
};

export function useTaskEditModal({ onOpenChangeAction, task, users = [], onTaskUpdated }: UseTaskEditModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [executors, setExecutors] = useState<TaskParticipant[]>([]);
  const [nonRegisteredExecutor, setNonRegisteredExecutor] = useState("");
  const [reporters, setReporters] = useState<TaskParticipant[]>([]);
  const [nonRegisteredReporter, setNonRegisteredReporter] = useState("");

  // フォーム初期化
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
        detail: task.detail ?? "",
        reference: task.reference ?? "",
        info: task.info ?? "",
        imageUrl: task.imageUrl ?? "",
        contributionType: task.contributionType,
        category: task.category ?? "その他",
      });

      // 実行者と報告者をセット
      setExecutors(task.executors ?? []);
      setReporters(task.reporters ?? []);
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

  // 更新を実行する関数
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

      if (result?.success) {
        toast.success("タスクを更新しました");

        // モーダルを閉じる
        onOpenChangeAction(false);

        // データの更新を親コンポーネントに通知
        if (onTaskUpdated) {
          onTaskUpdated();
        }

        // Next.jsのルーターキャッシュを更新
        router.refresh();

        // リアルタイム更新を促進するため、URLに小さな変更を加えて戻す
        const currentPath = window.location.pathname;
        const hasQuery = window.location.search.length > 0;
        const refreshParam = `_t=${Date.now()}`;

        const newPath = hasQuery ? `${currentPath}${window.location.search}&${refreshParam}` : `${currentPath}?${refreshParam}`;

        // URLを一時的に変更して元に戻す（画面のチラつきを防ぐため遅延実行）
        setTimeout(() => {
          router.replace(newPath);
          setTimeout(() => {
            router.replace(currentPath + (window.location.search ?? ""));
          }, 100);
        }, 100);
      } else {
        const errorMessage = result?.error ?? "タスクの更新に失敗しました（不明なエラー）";
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

  // モーダルの開閉ハンドラー
  const handleOpenChange = (isOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChangeAction(isOpen);
    }
  };

  return {
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
  };
}
