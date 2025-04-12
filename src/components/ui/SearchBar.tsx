"use client";

import React, { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export default function SearchBar({ className, ...props }: SearchBarProps) {
  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Search className="absolute left-3 h-4 w-4 text-gray-400" />
      <input
        type="text"
        className="focus:ring-primary w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 focus:border-transparent focus:ring-2 focus:outline-none"
        {...props}
      />
    </div>
  );
}
