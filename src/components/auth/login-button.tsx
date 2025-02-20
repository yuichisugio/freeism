"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

// ログインボタンの引数は入れない。カスタムログインページに遷移させたいため。
export function LoginButton() {
  return (
    <Button
      onClick={() => signIn()}
      className="bg-blue-600 text-white hover:bg-blue-700"
    >
      利用する
    </Button>
  );
}
