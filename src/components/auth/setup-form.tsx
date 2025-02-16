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
import * as z from "zod";

const setupSchema = z.object({
  username: z
    .string()
    .min(2, {
      message: "ユーザー名は2文字以上で入力してください。",
    })
    .max(30, {
      message: "ユーザー名は30文字以下で入力してください。",
    }),
  lifeGoal: z
    .string()
    .min(2, {
      message: "人生の目標は10文字以上で入力してください。",
    })
    .max(200, {
      message: "人生の目標は200文字以下で入力してください。",
    }),
  groupName: z
    .string()
    .min(2, {
      message: "グループ名は2文字以上で入力してください。",
    })
    .max(30, {
      message: "グループ名は30文字以下で入力してください。",
    }),
  evaluationMethod: z
    .string()
    .min(2, {
      message: "評価方法は10文字以上で入力してください。",
    })
    .max(200, {
      message: "評価方法は200文字以下で入力してください。",
    }),
});

type SetupForm = z.infer<typeof setupSchema>;

export function SetupForm() {
  const router = useRouter();
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      username: "",
      lifeGoal: "",
      groupName: "",
      evaluationMethod: "",
    },
  });

  async function onSubmit(data: SetupForm) {
    try {
      const result = await updateUserSetup(data);

      if (result.success) {
        router.push("/dashboard");
      } else if (result.error) {
        form.setError("root", { message: result.error });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      form.setError("root", { message: "予期せぬエラーが発生しました。" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ユーザー名</FormLabel>
              <FormControl>
                <Input placeholder="ユーザー名を入力" {...field} />
              </FormControl>
              <FormDescription>
                あなたの表示名として使用されます
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lifeGoal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>人生の目標</FormLabel>
              <FormControl>
                <Textarea placeholder="あなたの人生の目標を入力" {...field} />
              </FormControl>
              <FormDescription>
                あなたが達成したい人生の目標を記入してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="groupName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>グループ名</FormLabel>
              <FormControl>
                <Input placeholder="グループ名を入力" {...field} />
              </FormControl>
              <FormDescription>
                所属するグループ名を入力してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="evaluationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>評価方法</FormLabel>
              <FormControl>
                <Textarea placeholder="目標達成の評価方法を入力" {...field} />
              </FormControl>
              <FormDescription>
                目標達成をどのように評価するか記入してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <div className="text-red-500">
            {form.formState.errors.root.message}
          </div>
        )}

        <Button type="submit">設定を保存</Button>
      </form>
    </Form>
  );
}
