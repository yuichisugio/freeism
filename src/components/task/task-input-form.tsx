"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { taskFormSchema } from "@/lib/zod-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type Group = {
  id: string;
  name: string;
};

type TaskInputFormProps = {
  groups: Group[];
  groupId?: string;
};

const formSchema = taskFormSchema.extend({
  groupId: z.string({
    required_error: "グループを選択してください",
  }),
});

export type TaskFormValues = z.infer<typeof formSchema>;

export function TaskInputForm({ groups, groupId }: TaskInputFormProps) {
  const router = useRouter();
  const [openCombobox, setOpenCombobox] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task: "",
      reference: "",
      contributionType: "REWARD",
      groupId: groupId || "",
    },
  });

  async function onSubmit(data: TaskFormValues) {
    try {
      const result = await createTask(
        {
          task: data.task,
          reference: data.reference,
          contributionType: data.contributionType,
        },
        data.groupId,
      );

      if (result.success) {
        toast.success("タスクを保存しました");
        router.push(groupId ? `/dashboard/group/${groupId}` : "/dashboard/my-tasks");
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
        {!groupId && (
          <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="form-label-custom">Group選択</FormLabel>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" aria-expanded={openCombobox} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                        {field.value ? groups.find((group) => group.id === field.value)?.name : "グループを選択してください"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="グループを検索..." />
                      <CommandEmpty>グループが見つかりません</CommandEmpty>
                      <CommandGroup>
                        {groups.map((group) => (
                          <CommandItem
                            key={group.id}
                            value={group.name}
                            onSelect={() => {
                              form.setValue("groupId", group.id);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", group.id === field.value ? "opacity-100" : "opacity-0")} />
                            {group.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormDescription className="form-description-custom">タスクを登録するグループを選択してください</FormDescription>
                <FormMessage className="form-message-custom" />
              </FormItem>
            )}
          />
        )}

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

        <FormField
          control={form.control}
          name="task"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="form-label-custom">実行したタスク内容</FormLabel>
              <FormControl>
                <Textarea placeholder="タスクの内容を入力してください" className="form-control-custom" {...field} />
              </FormControl>
              <FormDescription className="form-description-custom">具体的な行動内容を記載してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="form-label-custom">参考にした内容</FormLabel>
              <FormControl>
                <Textarea placeholder="参考にした内容を入力してください" className="form-control-custom" {...field} />
              </FormControl>
              <FormDescription className="form-description-custom">タスクを実行する際に参考にした情報があれば記載してください</FormDescription>
              <FormMessage className="form-message-custom" />
            </FormItem>
          )}
        />

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
