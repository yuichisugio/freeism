// カスタムサインインページ
import type { Metadata } from "next";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "ログイン | Freeism-App",
  description: "Freeism-Appへのログインページです。",
};

export default function SignInPage() {
  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
        <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">
              ログイン
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Freeism-Appへようこそ
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <SignInButton
                  provider="google"
                  className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M23.766 12.277c0-.844-.07-1.655-.21-2.433H12.24v4.606h6.482c-.28 1.514-1.13 2.78-2.406 3.636v3.018h3.898c2.28-2.095 3.552-5.173 3.552-8.827z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12.24 24c3.258 0 5.985-1.08 7.978-2.896l-3.898-3.018c-1.08.724-2.46 1.15-4.08 1.15-3.136 0-5.79-2.117-6.74-4.96H1.497v3.12C3.467 21.3 7.577 24 12.24 24z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.5 14.276c-.24-.724-.378-1.497-.378-2.276s.138-1.552.378-2.276V6.604H1.497C.544 8.265 0 10.073 0 12c0 1.927.544 3.735 1.497 5.396l4.003-3.12z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12.24 4.788c1.767 0 3.355.607 4.603 1.798l3.456-3.456C18.203 1.16 15.476 0 12.24 0 7.577 0 3.467 2.7 1.497 6.604l4.003 3.12c.95-2.843 3.604-4.936 6.74-4.936z"
                      fill="#EA4335"
                    />
                  </svg>
                  Googleでログイン
                </SignInButton>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-neutral-500">または</span>
              </div>
            </div>

            <div className="text-center text-sm">
              <p className="text-neutral-600">
                アカウントをお持ちでない方は、
                <a
                  href="#"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  新規登録
                </a>
                からご登録ください。
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
