"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useBreakpoint } from "@/hooks/utils/use-breakpoint";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const NotificationButton = dynamic(() => import("./notification-button").then((mod) => mod.NotificationButton), {
  ssr: false,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ビューポートに応じて 1 つだけ NotificationButton をレンダリング
 * これを入れないと、ショートカットで通知Modalを開いたときに、2重で通知Modalが表示されてしまい、キャッシュがバグったり、escを2通さないと閉じられないようになる。
 * サーバー側の生成とClient側の生成が異なるハイドレーションエラーを避けるために、useEffectを使って、Client側でのみレンダリングするようにしている。
 */
export const NotificationButtonWrapper = ({ isMobile }: { isMobile: boolean }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const bp = useBreakpoint();
  if (!mounted) return null;
  console.log("bp.isSmUp/isMobile", bp.isSmUp, isMobile);
  const shouldShow = (bp.isSmUp && !isMobile) || (!bp.isSmUp && isMobile);
  return shouldShow ? <NotificationButton /> : null;
};
