"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CaptureList } from "@/components/capture/capture-list";
import { CaptureEditor } from "@/components/capture/capture-editor";
import { useCaptures } from "@/hooks/use-captures";
import { useWorkspaceContext } from "@/contexts/workspace-context";

function CapturesContent() {
  const { activeWorkspace } = useWorkspaceContext();
  const { days, loading } = useCaptures(activeWorkspace?.id ?? null);
  const [showNew, setShowNew] = useState(false);

  return (
    <>
      <Header title="Captures" />

      <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto space-y-4">
        {/* New capture button */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNew(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Capture
          </Button>
        </div>

        {/* Daily journal */}
        <CaptureList days={days} loading={loading} />
      </div>

      {/* New capture sheet (mobile-friendly) */}
      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>New Capture</SheetTitle>
          </SheetHeader>
          <CaptureEditor onSaved={() => setShowNew(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function CapturesPage() {
  return (
    <AppShell>
      <CapturesContent />
    </AppShell>
  );
}
