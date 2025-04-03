"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { PushNotificationProvider } from "./push-notification-provider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <PushNotificationProvider>
          {children}
          <Toaster />
        </PushNotificationProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
