"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickCapture } from "@/components/capture/quick-capture";
import { useWorkspaceContext } from "@/contexts/workspace-context";

/**
 * Global keyboard-triggered quick capture modal.
 * Opens with Ctrl+Shift+C (or Cmd+Shift+C on Mac).
 * Only available in intelligence workspaces.
 */
export function QuickCaptureModal() {
  const [open, setOpen] = useState(false);
  const { isIntelligence } = useWorkspaceContext();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isIntelligence) return;

      // Ctrl+Shift+C or Cmd+Shift+C
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setOpen(true);
      }
    },
    [isIntelligence]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isIntelligence) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Capture</DialogTitle>
        </DialogHeader>
        <QuickCapture onCaptured={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
