"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { ThemeProvider } from "@/lib/theme/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
