"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  CheckCircle2,
  Flag,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/shared";
import { MarkdownRenderer } from "@/components/shared";
import { TimerButton } from "@/components/time";
import { TaskContextEntries } from "@/components/task/task-context-entries";
import { useTask } from "@/hooks/use-task";
import { useTaskMutations } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import type { UpdateTaskInput } from "@/lib/validation";

export default function FocusViewPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const { task, isLoading, error } = useTask(taskId);
  const { updateTask } = useTaskMutations();

  const [description, setDescription] = useState(task?.description ?? "");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync local state when task loads
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  if (task && prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setDescription(task.description ?? "");
  }

  const handleUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!task) return;
      setLoading(true);
      const result = await updateTask(task.id, data);
      setLoading(false);
      if (!result) {
        setDescription(task.description ?? "");
      }
    },
    [task, updateTask]
  );

  const handleDescriptionSave = useCallback(async () => {
    const newDescription = description.trim() || null;
    if (newDescription !== task?.description) {
      await handleUpdate({ description: newDescription });
    }
    setIsEditingDescription(false);
  }, [description, task, handleUpdate]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (error || !task) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Task not found</p>
            <Button variant="outline" onClick={() => router.push("/tasks")}>
              Go to Tasks
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const isCompleted = task.status === "done";
  const isTaskOverdue = task.due_date && isOverdue(task.due_date);
  const priorityConfig = PRIORITY_DISPLAY_SHORT[task.priority];
  const statusConfig = STATUS_CONFIG[task.status];

  return (
    <AppShell>
      <div className="h-full flex flex-col">
        {/* Top Bar */}
        <div className="border-b border-border/40 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/tasks/${taskId}`)}
                className="gap-1.5 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {/* Status indicator */}
              <button className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {/* Task title */}
              <h1 className="text-sm font-medium truncate">{task.title}</h1>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Properties strip */}
              {task.due_date && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    isTaskOverdue && !isCompleted
                      ? "text-red-500"
                      : "text-muted-foreground"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDueDate(task.due_date)}
                </div>
              )}

              {task.priority !== "none" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flag
                    className={cn("h-3.5 w-3.5", priorityConfig.color)}
                  />
                  {priorityConfig.label}
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusConfig?.color || "bg-gray-400"
                  )}
                />
                {statusConfig?.label || task.status}
              </div>

              {/* Timer */}
              <TimerButton
                entityType="task"
                entityId={task.id}
                entityName={task.title}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Split Pane */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left: Description */}
          <div className="flex-1 md:w-1/2 md:border-r border-border/40 overflow-y-auto p-6 md:p-10">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Description
            </h2>

            {isEditingDescription ? (
              <div className="space-y-2">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDescription(task.description || "");
                      setIsEditingDescription(false);
                    }
                  }}
                  autoFocus
                  minHeight={200}
                  placeholder="Add a description..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleDescriptionSave}
                    disabled={loading}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDescription(task.description || "");
                      setIsEditingDescription(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="text-left w-full min-h-[200px] text-sm hover:bg-muted/30 rounded-md p-3 -mx-3 transition-colors"
              >
                {description || task.description ? (
                  <MarkdownRenderer
                    content={description || task.description}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    Click to add a description...
                  </p>
                )}
              </button>
            )}
          </div>

          {/* Right: Context & Findings */}
          <div className="flex-1 md:w-1/2 overflow-y-auto p-6 md:p-10 border-t md:border-t-0">
            <TaskContextEntries
              taskId={taskId}
              alwaysExpanded
              hideFocusLink
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
