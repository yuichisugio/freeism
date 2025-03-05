"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkGroupNameExists, checkGroupOwner, updateGroup } from "@/app/actions/group";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { createGroupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type z } from "zod";

/**
 * グループを編集するフォームのデータ型
 */
export type EditGroupFormData = z.infer<typeof createGroupSchema>;

/**
 * グループ編集フォームのプロパティ型定義
 */
type EditGroupFormProps = {
  group: {
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    maxParticipants: number;
  };
  onClose?: () => void;
};

/**
 * グループを編集するフォーム
 */
export function EditGroupForm({ group, onClose }: EditGroupFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isGroupOwner, setIsGroupOwner] = useState(false);

  // コンポーネントがマウントされた時にグループオーナー権限をチェック
  useEffect(() => {
    async function checkOwnerPermission() {
      try {
        if (session?.user?.id) {
          const hasPermission = await checkGroupOwner(group.id, session.user.id);
          setIsGroupOwner(hasPermission);
        }
      } catch (error) {
        console.error("グループオーナー権限チェックエラー:", error);
      }
    }

    checkOwnerPermission();
  }, [group.id, session?.user?.id]);

  const form = useForm<EditGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: group.name,
      goal: group.goal,
      evaluationMethod: group.evaluationMethod,
      maxParticipants: group.maxParticipants,
    },
  });

  async function onSubmit(data: EditGroupFormData) {
    try {
      // グループオーナーでない場合は処理を中断
      if (!isGroupOwner) {
        toast.error("グループオーナー権限がないため編集できません");
        return;
      }

      // 名前が変更されている場合のみ重複チェックを行う
      if (data.name !== group.name) {
        const existingGroup = await checkGroupNameExists(data.name);
        if (existingGroup) {
          form.setError("name", {
            message: "このグループ名は既に使用されています",
          });
          return;
        }
      }

      // グループを更新
      const result = await updateGroup(group.id, data);

      // 更新に成功した場合
      if (result.success) {
        toast.success("グループ情報を更新しました");
        if (onClose) onClose(); // ダイアログを閉じる
        router.refresh(); // 画面を更新
      } else if (result.error) {
        toast.error(result.error);
        console.error(result.error);
        form.setError("root", { message: result.error });
      }
    } catch (error) {
      console.log(error);
      toast.error("エラーが発生しました");
    }
  }

  // グループオーナーでない場合は権限がない旨を表示
  if (!isGroupOwner) {
    return (
      <div className="space-y-4">
        <h2 className="text-app mb-4 text-xl font-bold">グループ情報編集</h2>
        <p className="text-destructive">グループオーナー権限がないため、グループ情報を編集する権限がありません</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose || (() => {})}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-4 py-2 text-sm font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-app mb-4 text-xl font-bold">グループ情報編集</h2>
      <FormLayout
        form={form}
        onSubmit={onSubmit}
        submitLabel="変更を保存"
        submittingLabel="保存中..."
        showCancelButton={true}
        onCancel={onClose || (() => {})}
      >
        <CustomFormField
          fieldType="input"
          control={form.control}
          name="name"
          label="グループ名"
          placeholder="グループ名を入力してください"
          description="グループの名前を入力してください"
          type="text"
        />
        <CustomFormField
          fieldType="textarea"
          control={form.control}
          name="goal"
          label="最終目標"
          placeholder="グループの最終目標を入力してください"
          description="グループの最終目標を入力してください"
        />
        <CustomFormField
          fieldType="textarea"
          control={form.control}
          name="evaluationMethod"
          label="最終目標に貢献したか判断する方法"
          placeholder="目標達成の評価方法を入力してください"
          description="目標達成の評価方法を入力してください"
        />
        <CustomFormField
          fieldType="input"
          control={form.control}
          name="maxParticipants"
          label="参加上限人数"
          placeholder="参加上限人数を入力してください"
          description="参加上限人数を入力してください"
          type="number"
        />
      </FormLayout>
    </div>
  );
}
