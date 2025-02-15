"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserSetup } from "@/app/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const setupSchema = z.object({
  username: z
    .string()
    .min(2, "ユーザー名は2文字以上で入力してください")
    .max(30, "ユーザー名は30文字以内で入力してください"),
  lifeGoal: z
    .string()
    .min(10, "人生の目標は10文字以上で入力してください")
    .max(200, "人生の目標は200文字以内で入力してください"),
  referralSource: z
    .string()
    .min(2, "サービスを知ったきっかけは2文字以上で入力してください")
    .max(100, "サービスを知ったきっかけは100文字以内で入力してください"),
  groupName: z
    .string()
    .min(2, "グループ名は2文字以上で入力してください")
    .max(30, "グループ名は30文字以内で入力してください"),
  evaluationMethod: z
    .string()
    .min(10, "評価方法は10文字以上で入力してください")
    .max(200, "評価方法は200文字以内で入力してください"),
});

type SetupFormData = z.infer<typeof setupSchema>;

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
  });

  async function onSubmit(data: SetupFormData) {
    try {
      const result = await updateUserSetup(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      console.error("Error submitting form:", error);
      setError("予期せぬエラーが発生しました。");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* ユーザー名 */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-neutral-700"
          >
            ユーザー名
          </label>
          <input
            type="text"
            id="username"
            {...register("username")}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="例: John Doe"
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600">
              {errors.username.message}
            </p>
          )}
        </div>

        {/* 人生の目標 */}
        <div>
          <label
            htmlFor="lifeGoal"
            className="block text-sm font-medium text-neutral-700"
          >
            個人が人生で目標とすること
          </label>
          <textarea
            id="lifeGoal"
            {...register("lifeGoal")}
            rows={3}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="例: 世界中の人々の生活を豊かにするサービスを作りたい"
          />
          {errors.lifeGoal && (
            <p className="mt-1 text-sm text-red-600">
              {errors.lifeGoal.message}
            </p>
          )}
        </div>

        {/* サービスを知ったきっかけ */}
        <div>
          <label
            htmlFor="referralSource"
            className="block text-sm font-medium text-neutral-700"
          >
            どこでこのサービスを知りましたか？
          </label>
          <input
            type="text"
            id="referralSource"
            {...register("referralSource")}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="例: Twitterで見かけた"
          />
          {errors.referralSource && (
            <p className="mt-1 text-sm text-red-600">
              {errors.referralSource.message}
            </p>
          )}
        </div>

        {/* グループ名 */}
        <div>
          <label
            htmlFor="groupName"
            className="block text-sm font-medium text-neutral-700"
          >
            Group名
          </label>
          <input
            type="text"
            id="groupName"
            {...register("groupName")}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="例: チーム開発"
          />
          {errors.groupName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.groupName.message}
            </p>
          )}
        </div>

        {/* 評価方法 */}
        <div>
          <label
            htmlFor="evaluationMethod"
            className="block text-sm font-medium text-neutral-700"
          >
            最終目標に貢献したか判断する方法の選択
          </label>
          <textarea
            id="evaluationMethod"
            {...register("evaluationMethod")}
            rows={3}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="例: 毎週の振り返りで、目標達成度を5段階で評価する"
          />
          {errors.evaluationMethod && (
            <p className="mt-1 text-sm text-red-600">
              {errors.evaluationMethod.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "送信中..." : "設定を完了する"}
        </button>
      </div>
    </form>
  );
}
