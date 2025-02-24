"use client";

import { useRouter } from "next/navigation";
import { checkGroupNameExists, createGroup } from "@/app/actions";
import { CommonFormField } from "@/components/share/form-field";
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
        <CommonFormField control={form.control} name="name" label="グループ名" placeholder="グループ名を入力してください" description="グループの名前を入力してください" />

        <CommonFormField control={form.control} name="goal" label="最終目標" placeholder="グループの最終目標を入力してください" description="グループの最終目標を入力してください" isTextarea />

        <CommonFormField control={form.control} name="evaluationMethod" label="最終目標に貢献したか判断する方法" placeholder="目標達成の評価方法を入力してください" description="目標達成の評価方法を入力してください" isTextarea />

        <CommonFormField control={form.control} name="maxParticipants" label="参加上限人数" placeholder="参加上限人数を入力してください" description="参加上限人数を入力してください" type="number" />

        <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "作成中..." : "グループを作成"}
        </Button>
      </form>
    </Form>
  );
}
