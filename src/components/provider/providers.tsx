"use client";

import { memo } from "react";
import { persistOptions, queryClient } from "@/lib/tanstack-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ThemeProvider } from "next-themes";

import { PushNotificationProvider } from "./push-notification-provider";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プロバイダー
 */
export const Providers = memo(function Providers({ children }: { children: React.ReactNode }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <PushNotificationProvider>{children}</PushNotificationProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
});
