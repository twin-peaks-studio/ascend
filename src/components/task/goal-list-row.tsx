"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Target, Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import type { ProjectWithRelations } from "@/types";

interface GoalListRowProps {
  goal: ProjectWithRelations;
}

export function GoalListRow({ goal }: GoalListRowProps) {
  const router = useRouter();

  const taskCount = goal.tasks?.length || 0;
  const doneCount = goal.tasks?.filter((t) => t.status === "done").length || 0;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const overdue = goal.due_date && isOverdue(goal.due_date) && goal.status !== "completed";

  const handleClick = useCallback(() => {
    router.push(`/projects/${goal.id}`);
  }, [goal.id, router]);

  return (
    <div
      onClick={handleClick}
      className="group flex items-center gap-3 py-2.5 px-2 border-b border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
    >
      {/* Goal icon */}
      <Target className="h-5 w-5 shrink-0 text-violet-500" />

      {/* Goal content */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-sm font-medium truncate">{goal.title}</span>

        {/* Progress */}
        {taskCount > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress === 100 ? "bg-green-500" : "bg-violet-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {doneCount}/{taskCount}
            </span>
          </div>
        )}

        {/* Due date */}
        {goal.due_date && (
          <span className={cn(
            "inline-flex items-center gap-1 text-xs shrink-0",
            overdue ? "text-red-500" : "text-muted-foreground"
          )}>
            <Calendar className="h-3 w-3" />
            {formatDueDate(goal.due_date)}
          </span>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}
