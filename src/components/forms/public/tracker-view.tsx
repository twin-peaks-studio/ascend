"use client";

/**
 * TrackerView
 *
 * Tester-facing issue tracker. Renders all submitted feedback as cards
 * grouped by task status. Supports kanban and list view toggle.
 * Data is polled every 30s via useFormTracker — no auth, no drag-and-drop.
 *
 * Note: We do not reuse TaskListItem / KanbanBoard here because TrackerTask
 * does not conform to the full Task DB shape those components require.
 * A lean custom card is simpler and more appropriate for this read-only context.
 */

import { useState } from "react";
import { LayoutGrid, List, Clock, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";
import type { TrackerTask } from "@/types";

type ViewMode = "kanban" | "list";

const COLUMNS: Array<{ status: TrackerTask["status"]; label: string }> = [
  { status: "todo", label: "To Do" },
  { status: "in-progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

interface TrackerViewProps {
  tasks: TrackerTask[];
  isLoading: boolean;
}

export function TrackerView({ tasks, isLoading }: TrackerViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <p className="text-sm font-medium">No issues yet</p>
        <p className="text-xs text-muted-foreground">
          Submitted feedback will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-1 justify-end">
        <Button
          variant={viewMode === "kanban" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewMode("kanban")}
          aria-label="Kanban view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setViewMode("list")}
          aria-label="List view"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {viewMode === "kanban" ? (
        <KanbanView tasks={tasks} />
      ) : (
        <ListView tasks={tasks} />
      )}
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ tasks }: { tasks: TrackerTask[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </h3>
              <span className="text-xs text-muted-foreground">{colTasks.length}</span>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <TrackerCard key={task.submissionId} task={task} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No issues
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ tasks }: { tasks: TrackerTask[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border">
      {tasks.map((task) => (
        <TrackerListRow key={task.submissionId} task={task} />
      ))}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function TrackerCard({ task }: { task: TrackerTask }) {
  const priority = PRIORITY_DISPLAY_SHORT[task.priority];
  const isCompleted = task.status === "done";

  return (
    <div
      id={task.submissionId}
      className="rounded-lg border bg-card p-3 space-y-2 shadow-sm scroll-mt-20"
    >
      <div className="flex items-start justify-between gap-2">
        <StatusIcon status={task.status} />
        <p
          className={cn(
            "flex-1 text-sm font-medium leading-snug",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        <span className={cn("text-xs font-medium shrink-0", priority.color)}>
          {priority.label}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 pl-5">
          {plainText(task.description)}
        </p>
      )}
      <div className="flex items-center gap-1 pl-5">
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

function TrackerListRow({ task }: { task: TrackerTask }) {
  const priority = PRIORITY_DISPLAY_SHORT[task.priority];
  const isCompleted = task.status === "done";

  return (
    <div
      id={task.submissionId}
      className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors scroll-mt-20"
    >
      <StatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate">
            {plainText(task.description)}
          </p>
        )}
      </div>
      <span className={cn("text-xs font-medium shrink-0", priority.color)}>
        {priority.label}
      </span>
      <StatusBadge status={task.status} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TrackerTask["status"] }) {
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />;
  if (status === "in-progress")
    return <Clock className="h-4 w-4 shrink-0 text-blue-500" />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: TrackerTask["status"] }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.bgColor,
        config.color
      )}
    >
      {config.label}
    </span>
  );
}

/** Strip markdown bold markers for plain text preview. */
function plainText(str: string): string {
  return str.replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
}
