import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Freeism-App",
  description: "Freeism-Appのプライバシーポリシーをご確認ください。",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto min-h-screen px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-center text-3xl font-bold text-blue-900">
            プライバシーポリシー
          </h1>

          <div className="prose prose-blue mx-auto max-w-none space-y-6 text-neutral-700">
            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                1. 個人情報の収集
              </h2>
              <p>
                Freeism-App（以下、「当サービス」といいます。）は、以下の個人情報を収集することがあります：
              </p>
              <ul className="list-inside list-disc">
                <li>氏名</li>
                <li>メールアドレス</li>
                <li>プロフィール画像</li>
                <li>その他当サービスの利用に必要な情報</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                2. 個人情報の利用目的
              </h2>
              <p>当サービスは、収集した個人情報を以下の目的で利用します：</p>
              <ul className="list-inside list-disc">
                <li>ユーザー登録とアカウント管理</li>
                <li>サービスの提供と運営</li>
                <li>ユーザーサポート</li>
                <li>サービスの改善と新機能の開発</li>
                <li>不正アクセスの防止</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                3. 個人情報の管理
              </h2>
              <p>
                当サービスは、個人情報の漏洩、滅失、毀損等を防ぐため、必要な安全管理措置を講じます。
                個人情報は、アクセス制限や暗号化等の技術的措置を用いて適切に管理されます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                4. 個人情報の第三者提供
              </h2>
              <p>
                当サービスは、以下の場合を除き、収集した個人情報を第三者に提供することはありません：
              </p>
              <ul className="list-inside list-disc">
                <li>ユーザーの同意がある場合</li>
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要がある場合</li>
                <li>
                  公衆衛生の向上または児童の健全な育成の推進のために必要がある場合
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                5. Cookieの使用
              </h2>
              <p>
                当サービスは、ユーザーの利便性向上のためにCookieを使用することがあります。
                ユーザーはブラウザの設定によりCookieの使用を制限することができます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                6. プライバシーポリシーの変更
              </h2>
              <p>
                当サービスは、必要に応じて本プライバシーポリシーを変更することがあります。
                変更後のプライバシーポリシーは、当サービス上に掲載した時点から効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-blue-800">
                7. お問い合わせ
              </h2>
              <p>
                本プライバシーポリシーに関するお問い合わせは、当サービスの問い合わせフォームまでご連絡ください。
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
