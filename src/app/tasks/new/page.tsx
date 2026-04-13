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
const NO_WORKSPACE = "__none__";

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultProjectId = searchParams.get("project") ?? "";
  const fromPath = searchParams.get("from") ?? "/tasks";
  const defaultStatus = (searchParams.get("status") ?? "todo") as TaskStatus;

  const { activeWorkspace, workspaces } = useWorkspaceContext();

  // Workspace selection is local to this form — doesn't affect the global switcher.
  // Defaults to: active workspace → first workspace → none
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    return activeWorkspace?.id ?? workspaces[0]?.id ?? NO_WORKSPACE;
  });

  // Once workspaces load (may be async), seed the selection if still unset
  useEffect(() => {
    if (selectedWorkspaceId === NO_WORKSPACE && workspaces.length > 0) {
      setSelectedWorkspaceId(activeWorkspace?.id ?? workspaces[0].id);
    }
  }, [activeWorkspace, workspaces, selectedWorkspaceId]);

  const [selectedProjectId, setSelectedProjectId] = useState(
    defaultProjectId || NO_PROJECT
  );
  const [submitting, setSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { createTask } = useTaskMutations();
  const { projects } = useProjects(
    selectedWorkspaceId === NO_WORKSPACE ? undefined : selectedWorkspaceId
  );
  const { user } = useAuth();

  const activeProjects = projects.filter((p) => p.status === "active");

  const handleWorkspaceChange = useCallback((wsId: string) => {
    setSelectedWorkspaceId(wsId);
    setSelectedProjectId(NO_PROJECT); // reset project when workspace changes
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    },
    []
  );

  const [input, setInput] = useState("");

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

        {/* Mobile create button */}
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

      {/* Footer — workspace / project / create */}
      <div className="border-t px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">

          {/* Workspace → Project selectors */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Select
              value={selectedWorkspaceId}
              onValueChange={handleWorkspaceChange}
              disabled={submitting}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/40 text-sm select-none">/</span>

            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={submitting}
            >
              <SelectTrigger className="h-9 w-[140px]">
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

          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
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
