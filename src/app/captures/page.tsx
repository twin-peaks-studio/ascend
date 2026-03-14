"use client";

/**
 * Captures redirect page.
 *
 * Captures are accessed through workspace detail pages, not as a standalone route.
 * This page redirects to the active workspace (or workspaces list if none is active).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout";
import { useWorkspaceContext } from "@/contexts/workspace-context";

function CapturesRedirect() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspaceContext();

  useEffect(() => {
    if (activeWorkspace) {
      router.replace(`/workspaces/${activeWorkspace.id}`);
    } else {
      router.replace("/workspaces");
    }
  }, [activeWorkspace, router]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="text-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to workspace...</p>
      </div>
    </div>
  );
}

export default function CapturesPage() {
  return (
    <AppShell>
      <CapturesRedirect />
    </AppShell>
  );
}
