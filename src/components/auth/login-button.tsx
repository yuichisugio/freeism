"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <Button
      onClick={() => signIn("google", { callbackUrl: "/dashboard/grouplist" })}
      className="bg-blue-600 text-white hover:bg-blue-700"
    >
      利用する
    </Button>
  );
}
