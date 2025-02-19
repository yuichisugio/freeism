"use client";

import { useRouter } from "next/navigation";
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
import { createGroupSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type z } from "zod";

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;

export function CreateGroupForm() {
  // ここまでは来ている

  const router = useRouter();
  const form = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      goal: "",
      evaluationMethod: "",
      maxParticipants: 100,
    },
  });

  // ここまでは来ている

  async function onSubmit(data: CreateGroupFormData) {
    try {
      const result = await createGroup(data);

      if (result.success) {
        toast.success("グループを作成しました");
        router.push("/dashboard/grouplist");
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-app text-sm font-semibold sm:text-base">
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
              <FormLabel className="text-app text-sm font-semibold sm:text-base">
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
              <FormLabel className="text-app text-sm font-semibold sm:text-base">
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
              <FormLabel className="text-app text-sm font-semibold sm:text-base">
                参加上限人数
              </FormLabel>
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
              <FormDescription className="text-xs text-neutral-600 sm:text-sm">
                参加上限人数を入力してください
              </FormDescription>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="bg-app hover:bg-app/80 text-white"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "作成中..." : "グループを作成"}
        </Button>
      </form>
    </Form>
  );
}
