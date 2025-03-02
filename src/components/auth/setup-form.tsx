"use client";

import type * as z from "zod";
import { useRouter } from "next/navigation";
import { updateUserSetup } from "@/app/actions";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { setupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * フォームの型定義
 */
export type SetupForm = z.infer<typeof setupSchema>;

/**
 * セットアップフォームのプロパティ型定義
 */
type SetupFormProps = {
  initialData?: {
    username: string;
    lifeGoal: string;
  } | null;
};

/**
 * セットアップフォームコンポーネント
 * - ユーザー名と人生の目標を設定
 * - フォームバリデーション機能付き
 * - レスポンシブデザイン対応
 */
export function SetupForm({ initialData }: SetupFormProps) {
  const router = useRouter();

  // useForm関数を使用してフォームの状態を管理しています。これにより、フォームの入力値を管理し、エラーメッセージを表示することができます。
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    // フォームのバリデーションはzodResolverを使用して行われます。フォームのデフォルト値は、空の文字列として設定されています。
    defaultValues: {
      username: initialData?.username ?? "",
      lifeGoal: initialData?.lifeGoal ?? "",
    },
  });

  async function onSubmit(data: SetupForm) {
    try {
      // フォームの回答内容をSupabaseに保存する。更新or新規作成。戻り値はreact hook formの形式の成功か失敗かエラーメッセージ
      const result = await updateUserSetup(data);

      // Supabaseへのデータの保存が成功した場合
      if (result.error) {
        console.error(result.error);
        form.setError("root", { message: result.error });
        toast.error(result.error);
      } else {
        toast.success("設定を保存しました");
      }

      // 設定を保存した後、リロードする
      router.refresh();

      // 予期せぬエラーが発生した場合
    } catch (error) {
      console.error("Error submitting form:", error);
      // 予期せぬエラーが発生した場合、エラーメッセージを設定
      form.setError("root", { message: "予期せぬエラーが発生しました。" });
    }
  }

  return (
    // Formコンポーネントは、「RHFのFormProviderタグ」と「HTMLのformタグ」をラップしている。
    // Formコンポーネントに、useFormの戻り値を渡す。各設問のコンポーネントにuseFormの戻り値を渡すために、FormProviderをは、Formコンポーネントのコンテキストを提供する。
    <>
      <h2 className="text-app dark:text-app-dark mb-4 text-xl font-bold">変更内容</h2>
      <FormLayout form={form} onSubmit={onSubmit} submitLabel="設定を保存">
        <CustomFormField
          fieldType="input"
          control={form.control}
          name="username"
          label="ユーザー名"
          placeholder="ユーザー名を入力"
          description="あなたの表示名として使用されます"
          type="text"
        />

        <CustomFormField
          fieldType="textarea"
          control={form.control}
          name="lifeGoal"
          label="自分の人生の目標"
          placeholder="自分の人生の目標を入力"
          description="自分が達成したい人生の目標を記入してください"
        />
      </FormLayout>
    </>
  );
}
