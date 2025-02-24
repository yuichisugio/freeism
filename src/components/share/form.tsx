import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { type FieldValues, type UseFormReturn } from "react-hook-form";

type FormLayoutProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void>;
  /** 送信ボタンのラベル */
  submitLabel: string;
  /** 送信中のラベル（デフォルト: "送信中..."） */
  submittingLabel?: string;
  children: ReactNode;
  showCancelButton?: boolean;
  onCancel?: () => void;
  className?: string;
};

export function FormLayout<T extends FieldValues>({ form, onSubmit, submitLabel, submittingLabel, children, showCancelButton = false, onCancel, className = "space-y-6" }: FormLayoutProps<T>) {
  // 送信中のラベルのデフォルト値を設定
  const currentSubmittingLabel = submittingLabel ?? "送信中...";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className}>
        {children}
        {form.formState.errors.root && <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-500">{form.formState.errors.root.message}</div>}
        <div className="flex gap-4">
          <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? currentSubmittingLabel : submitLabel}
          </Button>
          {showCancelButton && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
