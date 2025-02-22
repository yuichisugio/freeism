"use client";

import { useRouter } from "next/navigation";
import { checkGroupNameExists, createGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGroupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type z } from "zod";

/**
 * グループを作成するフォームのデータ型
 * @returns グループを作成するフォームのデータ型
 */
export type CreateGroupFormData = z.infer<typeof createGroupSchema>;

/**
 * グループを作成するフォーム
 * @returns グループを作成するフォーム
 */
export function CreateGroupForm() {
  // ルーティング
  const router = useRouter();

  // フォーム
  const form = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      goal: "",
      evaluationMethod: "",
      maxParticipants: 100,
    },
  });

  async function onSubmit(data: CreateGroupFormData) {
    try {
      // グループ名の重複チェック
      const existingGroup = await checkGroupNameExists(data.name); // actionsに実装する必要があります

      if (existingGroup) {
        form.setError("name", {
          message: "このグループ名は既に使用されています",
        });
        return;
      }

      const result = await createGroup(data);

      if (result.success) {
        toast.success("グループを作成しました");
        router.push("/dashboard/grouplist");
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
      console.log(error);
      toast.error("エラーが発生しました");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col" style={{ gap: "5px" }}>
                <FormLabel className="form-label-custom">グループ名</FormLabel>
                <FormControl>
                  <Input id="name" placeholder="グループ名を入力してください" {...field} />
                </FormControl>
              </div>
              <FormDescription className="form-description-custom">グループの名前を入力してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col" style={{ gap: "5px" }}>
                <FormLabel className="form-label-custom">最終目標</FormLabel>
                <FormControl>
                  <Textarea id="goal" placeholder="グループの最終目標を入力してください" {...field} />
                </FormControl>
              </div>
              <FormDescription className="form-description-custom">グループの最終目標を入力してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="evaluationMethod"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col" style={{ gap: "5px" }}>
                <FormLabel className="form-label-custom">最終目標に貢献したか判断する方法</FormLabel>
                <FormControl>
                  <Textarea id="evaluationMethod" placeholder="目標達成の評価方法を入力してください" {...field} />
                </FormControl>
              </div>
              <FormDescription className="form-description-custom">目標達成の評価方法を入力してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maxParticipants"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col" style={{ gap: "5px" }}>
                <FormLabel className="form-label-custom">参加上限人数</FormLabel>
                <FormControl>
                  <Input
                    id="maxParticipants"
                    type="number"
                    placeholder="参加上限人数を入力してください"
                    {...field}
                    onChange={(e) => {
                      // e.target.valueAsNumber は空文字の場合 NaN になるので、チェックを入れる
                      const value = e.target.value;
                      // 空文字なら空文字、そうでなければ数値に変換
                      field.onChange(value === "" ? "" : Number(value));
                    }}
                  />
                </FormControl>
              </div>
              <FormDescription className="form-description-custom">参加上限人数を入力してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "作成中..." : "グループを作成"}
        </Button>
      </form>
    </Form>
  );
}
