import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export async function HeroSection() {
  // 認証状態を取得
  const session = await auth();

  return (
    <section className="relative bg-gradient-to-b from-blue-50 via-white to-white py-16 sm:py-24 lg:py-32">
      {/* 装飾的な背景要素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 -left-4 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl sm:h-[500px] sm:w-[500px]" />
        <div className="absolute top-1/2 -right-4 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-blue-100/50 blur-3xl sm:h-[500px] sm:w-[500px]" />
      </div>

      <div className="relative container mx-auto">
        <div className="mx-auto text-center sm:max-w-lg md:max-w-2xl lg:max-w-3xl">
          <h1 className="mb-4 bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
            新しい経済の仕組みを提案
          </h1>
          <p className="mx-auto mb-6 text-base leading-relaxed text-neutral-600 sm:mb-8 sm:text-lg md:text-xl">
            Freeism-Appは、資本主義に変わる経済の仕組みを提案し、体験できるWebサービスです。
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              variant="outline"
              size="lg"
              className="w-40 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-700 sm:w-auto sm:min-w-[200px]"
              asChild
            >
              <Link
                href="https://docs.google.com/document/d/1ksGHN6jWdwoMZ59-EX3g_CFXY3J3D7Qes4-TluqX7qU/edit?tab=t.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                詳細
              </Link>
            </Button>
            {/* sm(モバイル)では、ヘッダーにログイン/dashboardボタンがないため、↓に表示。ログイン済みの場合はdashboardボタンを表示 */}
            {session ? (
              <Button
                variant="outline"
                size="lg"
                className="w-40 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-700 sm:hidden sm:w-auto sm:min-w-[200px]"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <form
                className="sm:hidden"
                action={async () => {
                  "use server";
                  await signIn();
                }}
              >
                <Button
                  type="submit"
                  size="lg"
                  className="w-40 bg-blue-600 text-white hover:bg-blue-700 hover:text-white sm:w-auto sm:min-w-[200px]"
                >
                  利用する
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
