import { memo } from "react";
import { persistOptions, queryClient } from "@/lib/tanstack-query";
import { getAuthSession } from "@/lib/utils";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import { PushNotificationProvider } from "./push-notification-provider";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プロバイダー
 */
export const Providers = memo(async function Providers({ children }: { children: React.ReactNode }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッションを取得
  const session = await getAuthSession();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SessionProvider session={session}>
          <PushNotificationProvider>{children}</PushNotificationProvider>
        </SessionProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
});
