import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
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

export function FormLayout<T extends FieldValues>({ form, onSubmit, submitLabel, submittingLabel = "送信中...", children, showCancelButton = false, onCancel, className = "space-y-6" }: FormLayoutProps<T>) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={`${className} opacity-100 transition-opacity duration-300`}>
        {children}
        {form.formState.errors.root && <div className="rounded-md border border-red-100 bg-red-50 p-3 text-center text-sm text-red-500 shadow-sm">{form.formState.errors.root.message}</div>}
        <div className="flex gap-4">
          <div className="transition-transform hover:translate-y-[-2px] active:translate-y-[1px]">
            <Button type="submit" className={cn("button-default-custom", "mb-3", "relative overflow-hidden transition-all duration-300", form.formState.isSubmitting && "bg-opacity-80")} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                </span>
              )}
              <span className={form.formState.isSubmitting ? "opacity-70" : "opacity-100"}>{form.formState.isSubmitting ? submittingLabel : submitLabel}</span>
            </Button>
          </div>
          {showCancelButton && onCancel && (
            <div className="transition-transform hover:translate-y-[-2px] active:translate-y-[1px]">
              <Button type="button" variant="outline" onClick={onCancel} className="transition-all duration-300 hover:bg-gray-100">
                キャンセル
              </Button>
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
