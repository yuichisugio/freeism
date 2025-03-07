import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const buttonVariants = {
  hover: { scale: 1.05, transition: { duration: 0.2 } },
  tap: { scale: 0.98 },
  initial: { scale: 1 },
};

const errorVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

export function FormLayout<T extends FieldValues>({
  form,
  onSubmit,
  submitLabel,
  submittingLabel = "送信中...",
  children,
  showCancelButton = false,
  onCancel,
  className = "space-y-6",
}: FormLayoutProps<T>) {
  return (
    <Form {...form}>
      <motion.form onSubmit={form.handleSubmit(onSubmit)} className={`${className}`} initial="hidden" animate="visible" variants={formVariants}>
        {children}
        {form.formState.errors.root && (
          <motion.div className="rounded-md border border-red-100 bg-red-50 p-3 text-center text-sm text-red-500 shadow-sm" variants={errorVariants} initial="hidden" animate="visible">
            {form.formState.errors.root.message}
          </motion.div>
        )}
        <motion.div className="flex gap-4">
          <motion.div variants={buttonVariants} initial="initial" whileHover="hover" whileTap="tap">
            <Button
              type="submit"
              className={cn("button-default-custom", "mb-3", "relative overflow-hidden transition-all duration-300", form.formState.isSubmitting && "bg-opacity-80")}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <motion.span className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                </motion.span>
              )}
              <motion.span animate={{ opacity: form.formState.isSubmitting ? 0.7 : 1 }} transition={{ duration: 0.2 }}>
                {form.formState.isSubmitting ? submittingLabel : submitLabel}
              </motion.span>
            </Button>
          </motion.div>
          {showCancelButton && onCancel && (
            <motion.div variants={buttonVariants} initial="initial" whileHover="hover" whileTap="tap">
              <Button type="button" variant="outline" onClick={onCancel} className="transition-all duration-300 hover:bg-gray-100">
                キャンセル
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.form>
    </Form>
  );
}
