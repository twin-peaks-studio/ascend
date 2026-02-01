"use client";

import { useCallback } from "react";
import {
  Circle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { TaskWithProject, TaskStatus } from "@/types";
import { PRIORITY_CONFIG } from "@/types";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";

interface TaskListViewProps {
  tasks: TaskWithProject[];
  onTaskClick?: (task: TaskWithProject) => void;
  onStatusToggle?: (task: TaskWithProject) => void;
  onAddTask?: (status: TaskStatus) => void;
}

// Priority colors for the circle indicator
const PRIORITY_CIRCLE_COLORS: Record<string, string> = {
  urgent: "text-red-500 border-red-500",
  high: "text-orange-500 border-orange-500",
  medium: "text-blue-500 border-blue-500",
  low: "text-muted-foreground border-muted-foreground",
};

interface TaskListItemProps {
  task: TaskWithProject;
  onTaskClick?: (task: TaskWithProject) => void;
  onStatusToggle?: (task: TaskWithProject) => void;
}

function TaskListItem({ task, onTaskClick, onStatusToggle }: TaskListItemProps) {
  const isCompleted = task.status === "done";
  const priorityColor = PRIORITY_CIRCLE_COLORS[task.priority] || PRIORITY_CIRCLE_COLORS.medium;
  const taskOverdue = task.due_date && isOverdue(task.due_date) && !isCompleted;

  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusToggle?.(task);
  }, [task, onStatusToggle]);

  const handleRowClick = useCallback(() => {
    onTaskClick?.(task);
  }, [task, onTaskClick]);

  // Count attachments as "comments" indicator (similar to Todoist)
  const attachmentCount = task.attachments?.length || 0;

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "group flex items-start gap-3 py-3 px-2 border-b border-border/40 cursor-pointer",
        "hover:bg-muted/30 transition-colors",
        isCompleted && "opacity-60"
      )}
    >
      {/* Priority circle / checkbox */}
      <button
        onClick={handleStatusClick}
        className={cn(
          "mt-0.5 shrink-0 transition-colors",
          priorityColor
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={cn(
          "text-sm font-medium leading-tight",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {task.title}
        </p>

        {/* Description preview */}
        {task.description && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Meta row: due date, attachments count */}
        {(task.due_date || attachmentCount > 0) && (
          <div className="flex items-center gap-3 mt-1.5">
            {task.due_date && (
              <span className={cn(
                "inline-flex items-center gap-1 text-xs",
                taskOverdue ? "text-red-500" : "text-muted-foreground"
              )}>
                <Calendar className="h-3 w-3" />
                {formatDueDate(task.due_date)}
              </span>
            )}
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {attachmentCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Assignee avatar */}
      {task.assignee && (
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={task.assignee.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(task.assignee.display_name, task.assignee.email)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function TaskListView({
  tasks,
  onTaskClick,
  onStatusToggle,
  onAddTask,
}: TaskListViewProps) {
  // Sort tasks: incomplete first (sorted by position), then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    // Completed tasks go to the bottom
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    // Within same completion status, sort by position
    return a.position - b.position;
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card rounded-lg border">
        {sortedTasks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>No tasks yet</p>
            <p className="text-sm mt-1">Create a task to get started</p>
          </div>
        ) : (
          <div>
            {sortedTasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
                onStatusToggle={onStatusToggle}
              />
            ))}
          </div>
        )}

        {/* Add task button */}
        {onAddTask && (
          <button
            onClick={() => onAddTask("todo")}
            className="flex items-center gap-2 w-full py-3 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add task</span>
          </button>
        )}
      </div>
    </div>
  );
}
