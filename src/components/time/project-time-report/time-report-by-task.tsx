"use client";

/**
 * Time Report By Task View
 *
 * Shows all tasks with time entries, sorted by total time (most to least).
 * Includes task status badge for context.
 */

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/hooks/use-time-tracking";
import { cn } from "@/lib/utils";
import type { TaskTimeData } from "@/hooks/use-project-time-report";

interface TimeReportByTaskProps {
  tasks: TaskTimeData[];
  onTaskClick?: (taskId: string) => void;
}

const STATUS_CONFIG = {
  todo: { label: "To Do", color: "text-muted-foreground", bgColor: "bg-muted" },
  "in-progress": { label: "In Progress", color: "text-blue-600", bgColor: "bg-blue-100" },
  done: { label: "Done", color: "text-green-600", bgColor: "bg-green-100" },
};

export function TimeReportByTask({ tasks, onTaskClick }: TimeReportByTaskProps) {
  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No time tracked yet
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {tasks.map((task, index) => {
        const statusConfig = STATUS_CONFIG[task.taskStatus];
        return (
          <button
            key={task.taskId}
            onClick={() => onTaskClick?.(task.taskId)}
            className="flex items-start gap-3 py-3 border-b border-border/40 last:border-b-0 w-full text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-muted-foreground text-sm tabular-nums w-5">
              {index + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm truncate",
                    task.isArchived && "text-muted-foreground line-through"
                  )}
                >
                  {task.taskTitle}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    statusConfig.color,
                    statusConfig.bgColor
                  )}
                >
                  {statusConfig.label}
                </Badge>
                {task.isArchived && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 text-muted-foreground bg-muted"
                  >
                    Archived
                  </Badge>
                )}
              </div>
            </div>
            <span className="font-mono tabular-nums text-sm shrink-0">
              {formatDuration(task.totalSeconds)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
