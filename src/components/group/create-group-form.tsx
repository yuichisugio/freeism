"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
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
      setIsLoading(true);
      const result = await createGroup(data);

      if (result.success) {
        toast.success("グループを作成しました");
        router.push("/dashboard/grouplist");
        router.refresh();
      }

      toast.success("グループを作成しました");
      router.push("/dashboard/grouplist");
      router.refresh();
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-white/80 p-6 shadow-lg shadow-blue-100/20 backdrop-blur-sm sm:p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">グループ名</Label>
          <Input
            id="name"
            placeholder="グループ名を入力してください"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">最終目標</Label>
          <Textarea
            id="goal"
            placeholder="グループの最終目標を入力してください"
            {...register("goal")}
          />
          {errors.goal && (
            <p className="text-sm text-red-500">{errors.goal.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="evaluationMethod">
            最終目標に貢献したか判断する方法
          </Label>
          <Textarea
            id="evaluationMethod"
            placeholder="目標達成の評価方法を入力してください"
            {...register("evaluationMethod")}
          />
          {errors.evaluationMethod && (
            <p className="text-sm text-red-500">
              {errors.evaluationMethod.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxParticipants">参加上限人数</Label>
          <Input
            id="maxParticipants"
            type="number"
            min={1}
            max={1000}
            {...register("maxParticipants", { valueAsNumber: true })}
          />
          {errors.maxParticipants && (
            <p className="text-sm text-red-500">
              {errors.maxParticipants.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          disabled={isLoading}
        >
          {isLoading ? "作成中..." : "グループを作成"}
        </Button>
      </form>
    </div>
  );
}
