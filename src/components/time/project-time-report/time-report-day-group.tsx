"use client";

/**
 * Time Report Day Group Component
 *
 * An expandable section showing a single day's time entries
 * with tasks sorted by time spent.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { formatDuration } from "@/hooks/use-time-tracking";
import { cn } from "@/lib/utils";
import type { DayTaskData } from "@/hooks/use-project-time-report";

interface TimeReportDayGroupProps {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  tasks: DayTaskData[];
  defaultExpanded?: boolean;
  onTaskClick?: (taskId: string) => void;
}

export function TimeReportDayGroup({
  date,
  totalSeconds,
  tasks,
  defaultExpanded = false,
  onTaskClick,
}: TimeReportDayGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const dateObj = new Date(date + "T00:00:00"); // Parse as local date

  // Format the date header
  const formatDateHeader = () => {
    if (isToday(dateObj)) {
      return "Today";
    }
    if (isYesterday(dateObj)) {
      return "Yesterday";
    }
    return format(dateObj, "EEE, MMM d");
  };

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="flex-1 text-sm font-medium">{formatDateHeader()}</span>
        <span className="font-mono tabular-nums text-sm text-muted-foreground">
          {formatDuration(totalSeconds)}
        </span>
      </button>

      {isExpanded && (
        <div className="pl-6 pb-2 space-y-1">
          {tasks.map((task) => (
            <button
              key={task.taskId}
              onClick={() => onTaskClick?.(task.taskId)}
              className="flex items-center justify-between py-1 text-sm w-full text-left hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
            >
              <span className="text-muted-foreground truncate pr-4">
                {task.taskTitle}
              </span>
              <span className="font-mono tabular-nums text-xs shrink-0">
                {formatDuration(task.seconds)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
