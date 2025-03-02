"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions/task";
import { CustomFormField } from "@/components/share/form-field";
import { FormLayout } from "@/components/share/form-layout";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Group = {
  id: string;
  name: string;
};

const formSchema = taskFormSchema.extend({
  groupId: z.string({
    required_error: "グループに参加して下さい。",
  }),
});

export type TaskFormValues = z.infer<typeof formSchema>;

export type TaskFormValuesAndGroupId = TaskFormValues & {
  groupId: string;
};

export function TaskInputForm({ groups, groupComboBoxFlag }: { groups: Group[]; groupComboBoxFlag: boolean }) {
  // ルーター
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // フォーム
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task: "",
      reference: "",
      contributionType: "REWARD",
    },
  });

  // フォーム送信
  async function onSubmit(data: TaskFormValues) {
    console.log("フォーム送信データ:", data);

    try {
      // タスクを保存
      const result = await createTask({
        task: data.task,
        reference: data.reference,
        contributionType: data.contributionType,
        groupId: data.groupId,
      });

      if (result.success) {
        toast.success("タスクを保存しました");
        router.push(result.task.groupId ? `/dashboard/group/${result.task.groupId}` : "/dashboard/my-tasks");
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("フォーム送信エラー:", error);
      toast.error("タスクの保存に失敗しました");
    }
  }

  return (
    <FormLayout form={form} onSubmit={onSubmit} submitLabel="保存" submittingLabel="保存中...">
      {/* グループ選択が必要な場合 */}
      {groupComboBoxFlag && (
        <CustomFormField
          open={open}
          setOpen={setOpen}
          fieldType="combobox"
          control={form.control}
          name="groupId"
          label="グループ選択"
          description="タスクを登録するグループを選択してください"
          options={groups}
          placeholder="グループを選択してください"
          searchPlaceholder="グループを検索..."
          emptyMessage="グループに参加して下さい。"
        />
      )}

      <CustomFormField
        fieldType="radio"
        control={form.control}
        name="contributionType"
        label="貢献の種類"
        options={[
          { value: "REWARD", label: "報酬になる貢献" },
          { value: "NON_REWARD", label: "報酬にならない貢献" },
        ]}
      />

      <CustomFormField
        fieldType="textarea"
        control={form.control}
        name="task"
        label="実行したタスク内容"
        description="具体的な行動内容を記載してください"
        placeholder="タスクの内容を入力してください"
      />

      <CustomFormField
        fieldType="textarea"
        control={form.control}
        name="reference"
        label="参考にした内容"
        description="タスクを実行する際に参考にした情報があれば記載してください"
        placeholder="参考にした内容を入力してください"
      />
    </FormLayout>
  );
}
