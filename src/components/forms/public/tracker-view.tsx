"use client";

/**
 * TrackerView
 *
 * Tester-facing issue tracker. Renders all submitted feedback as cards
 * grouped by task status. Supports kanban and list view toggle.
 * Data is polled every 30s via useFormTracker — no auth, no drag-and-drop.
 *
 * Clicking any card/row opens a Sheet with full task details:
 * description, status, priority, submitted date, and downloadable attachments.
 *
 * Note: We do not reuse TaskListItem / KanbanBoard here because TrackerTask
 * does not conform to the full Task DB shape those components require.
 * A lean custom card is simpler and more appropriate for this read-only context.
 */

import { useState } from "react";
import {
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  Circle,
  Paperclip,
  FileText,
  Image,
  Video,
  Archive,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";
import type { TrackerTask, TrackerAttachment } from "@/types";

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
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);

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
    <>
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
          <KanbanView tasks={tasks} onSelect={setSelectedTask} />
        ) : (
          <ListView tasks={tasks} onSelect={setSelectedTask} />
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTask && <TaskDetail task={selectedTask} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ tasks, onSelect }: { tasks: TrackerTask[]; onSelect: (t: TrackerTask) => void }) {
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
                <TrackerCard key={task.submissionId} task={task} onClick={() => onSelect(task)} />
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

function ListView({ tasks, onSelect }: { tasks: TrackerTask[]; onSelect: (t: TrackerTask) => void }) {
  return (
    <div className="divide-y divide-border rounded-lg border">
      {tasks.map((task) => (
        <TrackerListRow key={task.submissionId} task={task} onClick={() => onSelect(task)} />
      ))}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function TrackerCard({ task, onClick }: { task: TrackerTask; onClick: () => void }) {
  const priority = PRIORITY_DISPLAY_SHORT[task.priority];
  const isCompleted = task.status === "done";

  return (
    <button
      type="button"
      id={task.submissionId}
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card p-3 space-y-2 shadow-sm scroll-mt-20 hover:bg-muted/30 transition-colors cursor-pointer"
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
      <div className="flex items-center gap-2 pl-5">
        <StatusBadge status={task.status} />
        {task.attachmentCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {task.attachmentCount}
          </span>
        )}
      </div>
    </button>
  );
}

function TrackerListRow({ task, onClick }: { task: TrackerTask; onClick: () => void }) {
  const priority = PRIORITY_DISPLAY_SHORT[task.priority];
  const isCompleted = task.status === "done";

  return (
    <button
      type="button"
      id={task.submissionId}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors scroll-mt-20 cursor-pointer"
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
      {task.attachmentCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Paperclip className="h-3 w-3" />
          {task.attachmentCount}
        </span>
      )}
      <StatusBadge status={task.status} />
    </button>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function TaskDetail({ task }: { task: TrackerTask }) {
  const priority = PRIORITY_DISPLAY_SHORT[task.priority];
  const submittedDate = new Date(task.submittedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6 pt-2">
      <SheetHeader>
        <SheetTitle className="text-base font-semibold leading-snug pr-6">
          {task.title}
        </SheetTitle>
      </SheetHeader>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status={task.status} />
        <span className={cn("font-medium", priority.color)}>{priority.label}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Submitted {submittedDate}</span>
      </div>

      {/* Description */}
      {task.description && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </p>
          <div className="text-sm leading-relaxed space-y-1 whitespace-pre-wrap">
            {renderDescription(task.description)}
          </div>
        </div>
      )}

      {/* Attachments */}
      {(task.attachments ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attachments
          </p>
          <ul className="space-y-1.5">
            {(task.attachments ?? []).map((att) => (
              <AttachmentRow key={att.id} attachment={att} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: TrackerAttachment }) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
      <AttachmentIcon mimeType={attachment.mimeType} />
      <span className="flex-1 text-sm truncate">{attachment.filename}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatBytes(attachment.fileSize)}
      </span>
      <a
        href={attachment.url}
        download={attachment.filename}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label={`Download ${attachment.filename}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="h-4 w-4" />
      </a>
    </li>
  );
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (mimeType.includes("zip")) return <Archive className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip markdown bold markers for compact plain text preview. */
function plainText(str: string): string {
  return str.replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
}

/**
 * Render description with basic markdown support:
 * **text** → bold, \n → line break, --- → divider.
 * Returns an array of JSX elements.
 */
function renderDescription(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    if (line === "---") {
      return <hr key={i} className="border-border my-2" />;
    }
    // Replace **text** with <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return <p key={i} className={line === "" ? "h-2" : ""}>{rendered}</p>;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
