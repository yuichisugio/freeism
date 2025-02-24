"use client";

import { useRouter } from "next/navigation";
import { checkGroupNameExists, updateGroup } from "@/app/actions";
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

export type EditGroupFormData = z.infer<typeof createGroupSchema>;

type EditGroupFormProps = {
  group: {
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    maxParticipants: number;
  };
};

export function EditGroupForm({ group }: EditGroupFormProps) {
  const router = useRouter();
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
      // 編集前のグループ名と編集後のグループ名が同じ場合は重複チェックをしない
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
        toast.success("グループを更新しました");
        router.push("/dashboard/grouplist");

        // 更新に失敗した場合
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <CommonFormField control={form.control} name="name" label="グループ名" placeholder="グループ名を入力してください" description="グループの名前を入力してください" />

        <CommonFormField control={form.control} name="goal" label="最終目標" placeholder="グループの最終目標を入力してください" description="グループの最終目標を入力してください" isTextarea />

        <CommonFormField control={form.control} name="evaluationMethod" label="最終目標に貢献したか判断する方法" placeholder="目標達成の評価方法を入力してください" description="目標達成の評価方法を入力してください" isTextarea />

        <CommonFormField control={form.control} name="maxParticipants" label="参加上限人数" placeholder="参加上限人数を入力してください" description="参加上限人数を入力してください" type="number" />

        <div className="flex gap-4">
          <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "更新中..." : "グループを更新"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
