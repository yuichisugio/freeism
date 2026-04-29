"use cache";

import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { GitHubLogoSvg, TwitterLogoSvg } from "@/components/ui/svg";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フッターコンポーネント
 */
export async function Footer() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <footer className="w-full border-t border-blue-100 bg-gradient-to-b from-white to-blue-50 dark:border-blue-900 dark:from-gray-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center">
          {/* フッターナビゲーション */}
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-2 sm:gap-40 sm:text-left">
            {/* Legal情報セクション */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-blue-900 sm:mb-4 dark:text-blue-100">Legal</h3>
              <ul className="space-y-2 sm:space-y-3">
                <li>
                  <Link
                    href="/terms"
                    className="text-sm text-neutral-600 transition-colors hover:text-blue-600 sm:text-base dark:text-neutral-400 dark:hover:text-blue-300"
                  >
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-neutral-600 transition-colors hover:text-blue-600 sm:text-base dark:text-neutral-400 dark:hover:text-blue-300"
                  >
                    プライバシーポリシー
                  </Link>
                </li>
              </ul>
            </div>

            {/* SNSリンクセクション */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-blue-900 sm:mb-4 dark:text-blue-100">About</h3>
              <div className="flex justify-center space-x-4 sm:justify-start">
                {/* Twitterリンク */}
                <a
                  href="https://x.com/sugi_sugi_329"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-300"
                >
                  <TwitterLogoSvg />
                </a>
                {/* GitHubリンク */}
                <a
                  href="https://github.com/yuichisugio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-300"
                >
                  <GitHubLogoSvg />
                </a>
              </div>
            </div>
          </div>

          {/* コピーライト */}
          <div className="relative mt-8 w-screen border-t border-blue-100 pt-6 text-center sm:mt-12 sm:pt-8 dark:border-blue-900">
            <p className="text-xs text-neutral-600 sm:text-sm dark:text-neutral-400">
              © {new Date().getFullYear()} Freeism-App. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
