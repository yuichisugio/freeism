"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { PushNotificationProvider } from "./push-notification-provider";

type ProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function Providers({ children, session }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider session={session}>
        <PushNotificationProvider>
          {children}
          <Toaster />
        </PushNotificationProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
