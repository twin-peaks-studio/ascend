/**
 * Feedback Forms Layout
 *
 * Standalone layout for tester-facing pages (/forms/[slug] and /forms/[slug]/tracker).
 * Intentionally omits all Ascend auth providers (AuthProvider, SidebarProvider,
 * AppRecoveryProvider) — testers are not Ascend users.
 * Only QueryProvider and Toaster are included for data fetching and notifications.
 */

import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

export default function FormsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="min-h-dvh bg-background text-foreground">
        {children}
      </div>
      <Toaster position="bottom-right" />
    </QueryProvider>
  );
}
