"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/actions/group/group";
import { CustomFormField } from "@/components/share/form/form-field";
import { FormLayout } from "@/components/share/form/form-layout";
import { createGroupSchema } from "@/library-setting/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Prisma } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type z } from "zod";

// --------------------------------------------------

/**
 * グループを作成するフォームのデータ型
 * @returns グループを作成するフォームのデータ型
 */
export type CreateGroupFormData = z.infer<typeof createGroupSchema>;

// --------------------------------------------------

/**
 * グループを作成するフォーム
 * @returns グループを作成するフォーム
 */
export const CreateGroupForm = memo(function CreateGroupForm(): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーティング
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォーム
   */
  const form = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      goal: "",
      evaluationMethod: "",
      maxParticipants: 100,
      depositPeriod: 30,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ作成フォームの送信処理
   */
  const onSubmit = useCallback(
    async (data: CreateGroupFormData) => {
      try {
        const result = await createGroup(data);

        if (result.success) {
          toast.success("グループを作成しました");
          router.push("/dashboard/group-list");
        } else if (result.error) {
          // 重複エラーの場合はフォームにエラーを表示
          if (result.error === "このグループ名は既に使用されています") {
            form.setError("name", {
              message: result.error,
            });
          } else {
            toast.error(result.error);
            console.error(result.error);
            form.setError("root", { message: result.error });
          }
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          toast.error("このグループ名は既に使用されています");
        } else {
          toast.error("エラーが発生しました");
        }
      }
    },
    [form, router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 型安全性のため form の型を明示的に指定
   */
  const typedForm = form as unknown as UseFormReturn<FieldValues>;
  const typedOnSubmit = onSubmit as (data: FieldValues) => Promise<void>;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ作成フォームを返す
   */
  return (
    <FormLayout form={typedForm} onSubmit={typedOnSubmit} submitLabel="グループを作成" submittingLabel="作成中...">
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

      <CustomFormField
        fieldType="input"
        control={form.control}
        name="depositPeriod"
        label="ポイント預け入れ期間（日数）"
        placeholder="ポイント預け入れ期間を入力してください"
        description="報酬タスクでポイントを預け入れる期間の日数（1〜9999日）"
        type="number"
        min={1}
        max={9999}
      />
    </FormLayout>
  );
});
