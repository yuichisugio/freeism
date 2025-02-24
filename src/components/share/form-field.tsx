import { type ReactNode } from "react";
import { type Control, type FieldValues, type Path } from "react-hook-form";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type CommonFormFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  description: string;
  type?: string;
  isTextarea?: boolean;
  children?: ReactNode;
};

export function CommonFormField<T extends FieldValues>({ control, name, label, placeholder, description, type = "text", isTextarea = false, children }: CommonFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex flex-col gap-1.5">
            <FormLabel className="form-label-custom">{label}</FormLabel>
            <FormControl>{isTextarea ? <Textarea id={name} placeholder={placeholder} {...field} /> : <Input id={name} type={type} placeholder={placeholder} {...field} />}</FormControl>
          </div>
          <FormDescription className="form-description-custom">{description}</FormDescription>
          <FormMessage className="form-message-custom" />
          {children}
        </FormItem>
      )}
    />
  );
}
