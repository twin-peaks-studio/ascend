"use client";

import { useCallback, useMemo } from "react";
import {
  Circle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TaskWithProject, TaskStatus, Task, Profile } from "@/types";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import {
  sortTasksWithCompletedLast,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";

// Priority colors for the circle indicator
export const PRIORITY_CIRCLE_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-blue-500",
  low: "text-muted-foreground",
};

interface TaskListViewProps {
  tasks: TaskWithProject[];
  onTaskClick?: (task: TaskWithProject) => void;
  onStatusToggle?: (task: TaskWithProject) => void;
  onAddTask?: (status: TaskStatus) => void;
  /** Remove the max-width container wrapper */
  compact?: boolean;
  /** Hide the empty state message */
  hideEmptyState?: boolean;
  /** Sort field (default: position) */
  sortField?: TaskSortField;
  /** Sort direction (default: asc) */
  sortDirection?: TaskSortDirection;
}

export interface TaskListItemProps {
  task: TaskWithProject | Task;
  onTaskClick?: (task: TaskWithProject | Task) => void;
  onStatusToggle?: (task: TaskWithProject | Task) => void;
  /** Assignee profile - required for Task type since it doesn't include assignee relation */
  assignee?: Profile | null;
}

export function TaskListItem({ task, onTaskClick, onStatusToggle, assignee }: TaskListItemProps) {
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
  // Use type narrowing to safely access attachments (only on TaskWithProject)
  const attachmentCount = ('attachments' in task && task.attachments) ? task.attachments.length : 0;

  // Get assignee - either from the task (TaskWithProject) or from the prop (Task)
  const taskAssignee = ('assignee' in task && task.assignee) ? task.assignee : assignee;

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
      {taskAssignee && (
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={taskAssignee.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(taskAssignee.display_name, taskAssignee.email)}
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
  sortField = "position",
  sortDirection = "asc",
}: TaskListViewProps) {
  // Sort tasks with completed tasks at the bottom
  const sortedTasks = useMemo(
    () => sortTasksWithCompletedLast(tasks, sortField, sortDirection),
    [tasks, sortField, sortDirection]
  );

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
                onTaskClick={onTaskClick as (task: TaskWithProject | Task) => void}
                onStatusToggle={onStatusToggle as (task: TaskWithProject | Task) => void}
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
