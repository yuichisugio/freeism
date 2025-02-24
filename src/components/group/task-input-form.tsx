"use client";

import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions";
import { CommonFormField } from "@/components/share/form-field";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type TaskInputFormProps = {
  groupId: string;
};

export type TaskFormValues = z.infer<typeof taskFormSchema>;

const formSchema = taskFormSchema.extend({
  groupId: z.string(),
});

export function TaskInputForm({ groupId }: TaskInputFormProps) {
  // ルーティング
  const router = useRouter();

  // フォームの初期化
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      task: "",
      reference: "",
      contributionType: "REWARD",
    },
    mode: "onSubmit",
  });

  // フォーム送信時の処理
  async function onSubmit(data: TaskFormValues) {
    try {
      const result = await createTask(
        {
          task: data.task,
          reference: data.reference,
          contributionType: data.contributionType,
        },
        groupId,
      );

      if (result.success) {
        toast.success("タスクを保存しました");
        router.push(`/dashboard/group/${groupId}`);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("タスクの保存に失敗しました");
      console.error(error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="contributionType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="form-label-custom">貢献の種類</FormLabel>
              <FormControl>
                <div className="border-input bg-background flex flex-col space-y-1 rounded-md border border-blue-200 px-3 py-2">
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                    <FormItem className="flex items-center space-y-0 space-x-3">
                      <FormControl>
                        <RadioGroupItem value="REWARD" className="border-blue-200" />
                      </FormControl>
                      <FormLabel className="font-normal">報酬になる貢献</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-y-0 space-x-3">
                      <FormControl>
                        <RadioGroupItem value="NON_REWARD" className="border-blue-200" />
                      </FormControl>
                      <FormLabel className="font-normal">報酬にならない貢献</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </div>
              </FormControl>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <CommonFormField control={form.control} name="task" label="実行したタスク内容" placeholder="タスクの内容を入力してください" description="具体的な行動内容を記載してください" isTextarea />

        <CommonFormField control={form.control} name="reference" label="参考にした内容" placeholder="参考にした内容を入力してください" description="タスクを実行する際に参考にした情報があれば記載してください" isTextarea />

        <div className="flex justify-start gap-4">
          <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "保存中..." : "保存"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
