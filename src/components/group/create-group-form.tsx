"use client";

import { createGroup } from "@/app/actions";
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
import { z } from "zod";

// バリデーションスキーマ
const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "グループ名を入力してください")
    .max(50, "グループ名は50文字以内で入力してください"),
  goal: z
    .string()
    .min(1, "目標を入力してください")
    .max(500, "目標は500文字以内で入力してください"),
  evaluationMethod: z
    .string()
    .min(1, "評価方法を入力してください")
    .max(1000, "評価方法は1000文字以内で入力してください"),
  maxParticipants: z
    .number()
    .min(1, "参加人数上限を入力してください")
    .max(1000, "参加人数上限は1000人以内で設定してください"),
});

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;

type CreateGroupFormProps = {
  userId: string;
};

export function CreateGroupForm({ userId }: CreateGroupFormProps) {
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
      const result = await createGroup(data);

      if (result.success) {
        toast.success("グループを作成しました");
      } else if (result.error) {
        toast.error(result.error);
        console.error(result.error);
        form.setError("root", { message: result.error });
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
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
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                グループ名
              </FormLabel>
              <FormControl>
                <Input
                  id="name"
                  placeholder="グループ名を入力してください"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                グループの名前を入力してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                最終目標
              </FormLabel>
              <FormControl>
                <Textarea
                  id="goal"
                  placeholder="グループの最終目標を入力してください"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                グループの最終目標を入力してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="evaluationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                最終目標に貢献したか判断する方法
              </FormLabel>
              <FormControl>
                <Textarea
                  id="evaluationMethod"
                  placeholder="目標達成の評価方法を入力してください"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                目標達成の評価方法を入力してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maxParticipants"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-blue-900 sm:text-base">
                参加上限人数
              </FormLabel>
              <FormControl>
                <Input
                  id="maxParticipants"
                  placeholder="参加上限人数を入力してください"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                参加上限人数を入力してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "作成中..." : "グループを作成"}
        </Button>
      </form>
    </Form>
  );
}
