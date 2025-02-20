// カスタムサインインページ
import type { Metadata } from "next";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { GoogleLogoSvg } from "@/components/ui/svg";

export const metadata: Metadata = {
  title: "ログイン | Freeism-App",
  description: "Freeism-Appへのログインページです。",
};

export default function SignInPage() {
  return (
    <>
      <Header />
      {/* コンテンツ全体の制御 */}
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50">
        {/* 文言が全て載る丸いパーツ。rounded-xlで丸くする */}
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          {/* 要素内のコンテンツを中央寄せする */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-blue-600">
              新規登録/ログイン
            </h1>
            <p className="mt-2 text-neutral-700">Freeism-Appへようこそ</p>
          </div>

          <div className="mt-8">
            <div className="flex">
              <SignInButton
                // inline-flexは、インライン要素として表示しながら内部はFlexが適用されます。ボタン内にテキストやアイコンが横並びに配置され、かつその要素自体がインラインにするために使用する。ブロック要素のように全幅を取らず、必要なサイズのみを占めるため、隣接する要素との間に隙間ができにくくなります。
                className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white py-3 text-sm font-bold text-neutral-800 transition-colors hover:bg-neutral-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                <GoogleLogoSvg />
                Google
              </SignInButton>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
