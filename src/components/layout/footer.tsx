import Link from "next/link";

/**
 * フッターコンポーネント
 * - サイトの基本情報とリンクを表示
 * - Legal情報へのリンク（利用規約、プライバシーポリシー）
 * - SNSリンク（Twitter、GitHub）
 * - コピーライト表示
 * - レスポンシブ対応（モバイルでは縦並び、デスクトップでは横並び）
 */
export function Footer() {
  return (
    <footer className="w-full border-t border-blue-100 bg-gradient-to-b from-white to-blue-50">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center">
          {/* フッターナビゲーション */}
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-2 sm:gap-40 sm:text-left">
            {/* Legal情報セクション */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-blue-900 sm:mb-4">
                Legal
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                <li>
                  <Link
                    href="/terms"
                    className="text-sm text-neutral-600 transition-colors hover:text-blue-600 sm:text-base"
                  >
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-neutral-600 transition-colors hover:text-blue-600 sm:text-base"
                  >
                    プライバシーポリシー
                  </Link>
                </li>
              </ul>
            </div>

            {/* SNSリンクセクション */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-blue-900 sm:mb-4">
                About
              </h3>
              <div className="flex justify-center space-x-4 sm:justify-start">
                {/* Twitterリンク */}
                <a
                  href="https://x.com/sugi_sugi_329"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 transition-colors hover:text-blue-600"
                >
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                {/* GitHubリンク */}
                <a
                  href="https://github.com/yuichisugio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 transition-colors hover:text-blue-600"
                >
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* コピーライト */}
          <div className="mt-8 w-full border-t border-blue-100 pt-6 text-center sm:mt-12 sm:pt-8">
            <p className="text-xs text-neutral-600 sm:text-sm">
              © {new Date().getFullYear()} Freeism-App. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
