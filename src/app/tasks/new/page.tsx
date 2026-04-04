"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  extractDateFromText,
  extractPriority,
  fallbackTitle,
} from "@/lib/task-parse-utils";
import type { TaskStatus } from "@/types";

const NO_PROJECT = "__none__";

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultProjectId = searchParams.get("project") ?? "";
  const fromPath = searchParams.get("from") ?? "/tasks";
  const defaultStatus = (searchParams.get("status") ?? "todo") as TaskStatus;

  const [input, setInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(
    defaultProjectId || NO_PROJECT
  );
  const [submitting, setSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { createTask } = useTaskMutations();
  const { activeWorkspace } = useWorkspaceContext();
  const { projects } = useProjects(activeWorkspace?.id);
  const { user } = useAuth();

  const activeProjects = projects.filter((p) => p.status === "active");

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      // Auto-resize
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

    // Date + priority extracted client-side — free, no network
    const extractedDate = extractDateFromText(trimmed, now);
    const extractedPriority = extractPriority(trimmed);

    // Title via AI, with synchronous fallback
    let title: string;
    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        title = data.title?.trim() || fallbackTitle(trimmed);
      } else {
        title = fallbackTitle(trimmed);
      }
    } catch {
      title = fallbackTitle(trimmed);
    }

    const result = await createTask({
      title,
      description: trimmed,
      priority: extractedPriority,
      due_date: extractedDate ? extractedDate.toISOString() : null,
      status: defaultStatus,
      position: 0,
      project_id:
        selectedProjectId === NO_PROJECT ? null : selectedProjectId || null,
      assignee_id: user?.id ?? null,
    });

    if (result) {
      router.push(`/tasks/${result.id}`);
    } else {
      // createTask already shows an error toast
      setSubmitting(false);
    }
  }, [
    input,
    submitting,
    selectedProjectId,
    defaultStatus,
    createTask,
    user,
    router,
    fromPath,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSubmit = input.trim().length > 0 && !submitting;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(fromPath)}
          className="-ml-2"
          disabled={submitting}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>

        <span className="text-sm font-medium text-muted-foreground">
          New Task
        </span>

        {/* Mobile create button — visible only on small screens */}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="min-w-[72px] md:hidden"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Create"
          )}
        </Button>

        {/* Desktop spacer to keep title centred */}
        <div className="hidden w-[72px] md:block" />
      </div>

      {/* Input area */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
          className="w-full resize-none bg-transparent text-xl font-medium leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
          rows={3}
          disabled={submitting}
        />

        <p className="mt-5 text-sm text-muted-foreground/50">
          Mention due dates, priority, or any context — AI will handle the
          rest.
          <span className="hidden sm:inline"> Press ⌘↵ to create.</span>
        </p>
      </div>

      {/* Footer — workspace label + project selector + create button */}
      <div className="border-t px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {activeWorkspace && (
              <span className="text-xs text-muted-foreground/60 shrink-0">
                {activeWorkspace.name}
              </span>
            )}
            {activeWorkspace && <span className="text-muted-foreground/30 text-xs">/</span>}
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={submitting}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {activeProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating…</span>
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense>
      <NewTaskForm />
    </Suspense>
  );
}
