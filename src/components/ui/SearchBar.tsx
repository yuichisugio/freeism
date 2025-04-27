"use client";

import React, { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type SearchBarProps = InputHTMLAttributes<HTMLInputElement> & {
  className: string | null;
};

export default function SearchBar({ className, ...props }: SearchBarProps) {
  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Search className="absolute left-3 h-4 w-4 text-gray-400" />
      <input type="text" className="h-full w-full border-0 bg-transparent pl-10 outline-none focus:ring-0 focus:outline-none" {...props} />
    </div>
  );
}
