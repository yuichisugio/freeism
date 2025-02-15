import type { Metadata } from "next";
import { SetupForm } from "@/components/auth/setup-form";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "アカウント設定 | Freeism-App",
  description: "Freeism-Appのアカウント設定ページです。",
};

export default function SetupPage() {
  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4 py-12">
        <div className="w-full max-w-2xl space-y-8 rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              アカウント設定
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Freeism-Appをより快適にご利用いただくために、以下の情報を入力してください。
            </p>
          </div>

          <SetupForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
