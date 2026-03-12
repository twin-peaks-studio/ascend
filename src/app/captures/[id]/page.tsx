"use client";

import { use } from "react";
import { AppShell } from "@/components/layout";
import { Header } from "@/components/layout";
import { CaptureEditor } from "@/components/capture/capture-editor";
import { useCapture } from "@/hooks/use-captures";

interface CaptureDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CaptureDetailPage({ params }: CaptureDetailPageProps) {
  const { id } = use(params);
  const { capture, loading } = useCapture(id);

  return (
    <AppShell>
      <Header title={capture?.title ?? "Capture"} />

      <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted/50 animate-pulse rounded" />
            <div className="h-32 w-full bg-muted/30 animate-pulse rounded" />
          </div>
        ) : capture ? (
          <CaptureEditor capture={capture} />
        ) : (
          <p className="text-muted-foreground text-center py-12">
            Capture not found
          </p>
        )}
      </div>
    </AppShell>
  );
}
