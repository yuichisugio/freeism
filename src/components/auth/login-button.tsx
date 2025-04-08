"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ログインボタン
 * @returns ログインボタン
 */
export const LoginButton = memo(function LoginButton() {
  return (
    <Button variant="outline" onClick={() => signIn()} className="button-default-custom">
      利用する
    </Button>
  );
});
