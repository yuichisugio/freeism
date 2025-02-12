"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <Button
      className="bg-blue-600 text-white hover:bg-blue-700"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      サインイン
    </Button>
  );
}
