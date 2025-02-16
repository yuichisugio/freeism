import type { Metadata } from "next";
import { SetupForm } from "@/components/auth/setup-form";

export const metadata: Metadata = {
  title: "アカウント設定 | Freeism-App",
  description: "Freeism-Appのアカウント設定ページです。",
};

export default function SetupPage() {
  return (
    <main className="container mx-auto p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">初期設定</h1>
        <SetupForm />
      </div>
    </main>
  );
}
