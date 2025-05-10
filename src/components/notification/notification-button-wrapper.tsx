"use client";

import { useBreakpoint } from "@/hooks/utils/use-breakpoint";

import { NotificationButton } from "./notification-button";

/**
 * ビューポートに応じて 1 つだけ NotificationButton をレンダリング
 * これを入れないと、ショートカットで通知Modalを開いたときに、2重で通知Modalが表示されてしまい、キャッシュがバグったり、escを2通さないと閉じられないようになる。
 */
export const NotificationButtonWrapper = () => {
  const bp = useBreakpoint();
  if (bp.isSmUp) {
    return <NotificationButton />;
  }
  return <NotificationButton />;
};
