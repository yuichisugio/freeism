"use client";

import type { Control, FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";
import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { checkGroupExistByName, updateGroup } from "@/lib/actions/group";
import { checkIsOwner } from "@/lib/actions/permission";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { createGroupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type z } from "zod";

// --------------------------------------------------

/**
 * グループを編集するフォームのデータ型
 */
type EditGroupFormData = z.infer<typeof createGroupSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
    depositPeriod: number;
  };
  onCloseAction?: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを編集するフォーム
 */
export const EditGroupForm = memo(function EditGroupForm({ group, onCloseAction }: EditGroupFormProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーティング
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッション
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループオーナー権限の取得
   */
  const { data: isGroupOwner = false } = useQuery({
    queryKey: queryCacheKeys.permission.groupOwner(group.id, userId ?? ""),
    queryFn: async () => await checkIsOwner(userId ?? "", group.id),
    enabled: !!userId && !!group.id,
    staleTime: 1000 * 60 * 60 * 24, // 24時間
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const form = useForm<EditGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: group.name,
      goal: group.goal,
      evaluationMethod: group.evaluationMethod,
      maxParticipants: group.maxParticipants,
      depositPeriod: group.depositPeriod,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const onSubmit = useCallback(
    async (data: EditGroupFormData) => {
      try {
        // グループオーナーでない場合は処理を中断
        if (!isGroupOwner) {
          toast.error("グループオーナー権限がないため編集できません");
          return;
        }

        // 名前が変更されている場合のみ重複チェックを行う
        if (data.name !== group.name) {
          const existingGroup = await checkGroupExistByName(data.name);
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
          if (onCloseAction) onCloseAction(); // ダイアログを閉じる
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
    },
    [form, group.id, group.name, isGroupOwner, onCloseAction, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // FormLayoutに渡すための型変換
  const typedForm = form as unknown as UseFormReturn<FieldValues>;
  const typedOnSubmit = onSubmit as SubmitHandler<FieldValues>;
  const typedControl = form.control as unknown as Control<FieldValues>;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // グループオーナーでない場合は権限がない旨を表示
  if (!isGroupOwner) {
    return (
      <div className="space-y-4">
        <h2 className="text-app mb-4 text-xl font-bold">グループ情報編集</h2>
        <p className="text-destructive">グループオーナー権限がないため、グループ情報を編集する権限がありません</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={
              onCloseAction ??
              (() => {
                /* ダイアログを閉じる */
              })
            }
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-4 py-2 text-sm font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-4">
      <FormLayout
        form={typedForm}
        onSubmit={typedOnSubmit}
        submitLabel="変更を保存"
        submittingLabel="保存中..."
        showCancelButton={true}
        onCancel={
          onCloseAction ??
          (() => {
            /* ダイアログを閉じる */
          })
        }
      >
        <CustomFormField
          fieldType="input"
          control={typedControl}
          name="name"
          label="グループ名"
          placeholder="グループ名を入力してください"
          description="グループの名前を入力してください"
          type="text"
        />
        <CustomFormField
          fieldType="textarea"
          control={typedControl}
          name="goal"
          label="最終目標"
          placeholder="グループの最終目標を入力してください"
          description="グループの最終目標を入力してください"
        />
        <CustomFormField
          fieldType="textarea"
          control={typedControl}
          name="evaluationMethod"
          label="最終目標に貢献したか判断する方法"
          placeholder="目標達成の評価方法を入力してください"
          description="目標達成の評価方法を入力してください"
        />
        <CustomFormField
          fieldType="input"
          control={typedControl}
          name="maxParticipants"
          label="参加上限人数"
          placeholder="参加上限人数を入力してください"
          description="参加上限人数を入力してください"
          type="number"
        />
        <CustomFormField
          fieldType="input"
          control={typedControl}
          name="depositPeriod"
          label="ポイント預け入れ期間（日数）"
          placeholder="ポイント預け入れ期間を入力してください"
          description="報酬タスクでポイントを預け入れる期間の日数（7〜90日）"
          type="number"
          min={7}
          max={90}
        />
      </FormLayout>
    </div>
  );
});
