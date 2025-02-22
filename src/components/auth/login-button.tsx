"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

// ログインボタンの引数は入れない。カスタムログインページに遷移させたいため。
export function LoginButton() {
  return (
    <Button variant="outline" onClick={() => signIn()} className="button-default-custom">
      利用する
    </Button>
  );
}
