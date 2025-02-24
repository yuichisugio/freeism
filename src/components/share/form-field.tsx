import { type ReactNode } from "react";

import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type CommonFormFieldProps = {
  control: any;
  name: string;
  label: string;
  placeholder: string;
  description: string;
  type?: string;
  isTextarea?: boolean;
  children?: ReactNode;
};

// export function CommonFormField({
//   control,
//   name,
//   label,
//   placeholder,
//   description,
//   type = "text",
//   isTextarea = false,
//   children,
// }: CommonFormFieldProps) {
//   return (
//     // <FormField
//     //   control={control}
//     //   name={name}
//     //   render={({ field }) => (
//     //     <FormItem>
//     //       <div className="flex flex-col" style={{ gap: "5px" }}>
//     //         <FormLabel className="form-label-custom">{label}</FormLabel>
//     //         <FormControl>
//     //           {isTextarea ? (
//     //             <Textarea id={name} placeholder={placeholder} {...field} />
//     //           ) : (
//     //             <Input id={name} type={type} placeholder={placeholder} {...field} />
//     //           )}
//     //         </FormControl>
//     //       </div>
//     //       <FormDescription className="form-description-custom">{description}</FormDescription>
//     //       <FormMessage className="form-message-custom" />
//     //       {children}
//     //     </FormItem>
//     //   )}
//     // />
//   // );
// }
