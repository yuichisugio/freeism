"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { type UseFormReturn } from "react-hook-form";

type FormLayoutProps = {
  form: UseFormReturn<any>;
  onSubmit: (data: any) => Promise<void>;
  submitLabel: string;
  submittingLabel?: string;
  children: React.ReactNode;
  showCancelButton?: boolean;
  onCancel?: () => void;
};

export function FormLayout({ form, onSubmit, submitLabel, submittingLabel, children, showCancelButton = false, onCancel }: FormLayoutProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {children}
        {form.formState.errors.root && <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-500">{form.formState.errors.root.message}</div>}
        <div className="flex gap-4">
          <Button type="submit" className="button-default-custom" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? submittingLabel || "送信中..." : submitLabel}
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
