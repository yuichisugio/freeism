import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | Freeism-App",
  description: "Freeism-Appの利用規約をご確認ください。",
};

export default function TermsPage() {
  return (
    <main className="container mx-auto min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-blue-900">
          利用規約
        </h1>

        <div className="prose prose-blue mx-auto max-w-none space-y-6 text-neutral-700">
          <section>
            <h2 className="text-xl font-semibold text-blue-800">1. はじめに</h2>
            <p>
              この利用規約（以下、「本規約」といいます。）は、Freeism-App（以下、「当サービス」といいます。）の利用条件を定めるものです。
              登録ユーザーの皆さま（以下、「ユーザー」といいます。）には、本規約に従って、当サービスをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blue-800">2. 利用登録</h2>
            <p>
              当サービスの利用を希望する方は、本規約に同意の上、当サービスの定める方法によって利用登録を行うものとします。
              当サービスは、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。
            </p>
            <ul className="list-inside list-disc">
              <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
              <li>本規約に違反したことがある者からの申請である場合</li>
              <li>その他、当サービスが利用登録を相当でないと判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blue-800">
              3. ユーザーの責任
            </h2>
            <p>
              ユーザーは、自己の責任において当サービスを利用するものとし、当サービスの利用に関して行った一切の行為およびその結果について一切の責任を負うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blue-800">4. 禁止事項</h2>
            <p>
              ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。
            </p>
            <ul className="list-inside list-disc">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サービスの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>
                当サービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blue-800">
              5. 規約の変更
            </h2>
            <p>
              当サービスは、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
              なお、本規約の変更後、当サービスの利用を継続した場合には、変更後の規約に同意したものとみなします。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
