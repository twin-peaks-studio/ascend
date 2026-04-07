"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  extractDateFromText,
  extractPriority,
  fallbackTitle,
} from "@/lib/task-parse-utils";

interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Shared content ───────────────────────────────────────────────────────────

interface ContentProps {
  onClose: () => void;
  isMobile?: boolean;
}

function QuickCaptureContent({ onClose, isMobile }: ContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { createTask } = useTaskMutations();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspaceContext();

  // Detect project context from URL (same pattern as ConversationalTaskModal)
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const contextProjectId = projectMatch?.[1] ?? null;

  useEffect(() => {
    // Small delay so the dialog animation completes before focusing
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);

    const now = new Date();
    const extractedDate = extractDateFromText(trimmed, now);
    const extractedPriority = extractPriority(trimmed);

    let title: string;
    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      title = res.ok
        ? (await res.json()).title?.trim() || fallbackTitle(trimmed)
        : fallbackTitle(trimmed);
    } catch {
      title = fallbackTitle(trimmed);
    }

    const result = await createTask({
      title,
      description: trimmed,
      priority: extractedPriority,
      due_date: extractedDate ? extractedDate.toISOString() : null,
      status: "todo",
      position: 0,
      project_id: contextProjectId,
      assignee_id: user?.id ?? null,
    });

    if (result) {
      onClose();
      router.push(`/tasks/${result.id}`);
    } else {
      setSubmitting(false);
    }
  }, [input, submitting, contextProjectId, createTask, user, router, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      // Esc is handled by the Dialog/Drawer primitives
    },
    [handleSubmit]
  );

  const canSubmit = input.trim().length > 0 && !submitting;

  return (
    <div className="flex flex-col">
      {/* Textarea */}
      <div className="px-4 pt-5 pb-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
          rows={isMobile ? 4 : 3}
          disabled={submitting}
          className="w-full resize-none bg-transparent text-base font-medium leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Footer hint + actions */}
      <div className="flex items-center justify-between border-t px-4 py-2.5 gap-3">
        <p className="text-xs text-muted-foreground/50 min-w-0 truncate">
          {submitting
            ? "Creating task…"
            : isMobile
            ? "Mention dates, priority, or any context"
            : "Mention dates, priority, or any context · ⌘↵"}
        </p>

        {/* Mobile needs an explicit button; desktop can rely on ⌘↵ but show it too */}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="shrink-0 gap-1.5"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Create
        </Button>
      </div>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function QuickCaptureModal({ open, onOpenChange }: QuickCaptureModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          {/* Extra padding below the drag handle */}
          <div className="pb-safe pb-4">
            <QuickCaptureContent
              onClose={() => onOpenChange(false)}
              isMobile
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Command-palette positioning:
        Override the default top-[50%] translate-y-[-50%] so the dialog
        sits at ~28% from the top instead of dead centre.
      */}
      <DialogContent
        showCloseButton={false}
        className="top-[28%] translate-y-0 p-0 gap-0 max-w-lg"
      >
        <QuickCaptureContent onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
