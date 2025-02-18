"use client";

import { useRouter } from "next/navigation";
import { updateUserSetup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

/**
 * セットアップフォームのバリデーションスキーマ
 */
const setupSchema = z.object({
  username: z
    .string()
    .min(2, { message: "2文字以上で入力してください" })
    .max(40, { message: "40文字以内で入力してください" }),
  lifeGoal: z
    .string()
    .min(2, { message: "2文字以上で入力してください" })
    .max(200, { message: "200文字以内で入力してください" }),
});

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                ユーザー名
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="ユーザー名を入力"
                  className="border-blue-100 bg-white/50 backdrop-blur-sm transition-colors focus:border-blue-300 focus:ring-blue-300"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                あなたの表示名として使用されます
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lifeGoal"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                自分の人生の目標
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="自分の人生の目標を入力"
                  className="min-h-[80px] border-blue-100 bg-white/50 backdrop-blur-sm transition-colors focus:border-blue-300 focus:ring-blue-300 sm:min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                自分が達成したい人生の目標を記入してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-500">
            {form.formState.errors.root.message}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full bg-blue-600 text-white transition-colors hover:bg-blue-700 sm:w-auto sm:min-w-[200px]"
          >
            設定を保存
          </Button>
        </div>
      </form>
    </Form>
  );
}
