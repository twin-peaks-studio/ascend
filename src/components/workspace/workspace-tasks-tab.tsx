"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Eye, EyeOff, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskListItem } from "@/components/task/task-list-view";
import { useWorkspaceTasks } from "@/hooks/use-workspace-tasks";
import { useTaskMutations } from "@/hooks/use-tasks";
import {
  sortTasksWithCompletedLast,
  filterTasksByDueDate,
  TASK_SORT_OPTIONS,
  DUE_DATE_FILTER_OPTIONS,
  type TaskSortField,
  type TaskSortDirection,
  type DueDateFilter,
} from "@/lib/task-sort";
import type { TaskWithProject, TaskStatus } from "@/types";
import type { Task } from "@/types/database";

interface WorkspaceTasksTabProps {
  workspaceId: string;
}

export function WorkspaceTasksTab({ workspaceId }: WorkspaceTasksTabProps) {
  const router = useRouter();
  const { tasks, loading } = useWorkspaceTasks(workspaceId);
  const { updateTask } = useTaskMutations();

  const [sortField, setSortField] = useState<TaskSortField>("priority");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("desc");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");

  const filteredTasks = useMemo(() => {
    let filtered = showCompleted ? tasks : tasks.filter((t) => t.status !== "done");
    filtered = filterTasksByDueDate(filtered, dueDateFilter);
    return sortTasksWithCompletedLast(filtered, sortField, sortDirection);
  }, [tasks, showCompleted, dueDateFilter, sortField, sortDirection]);

  const completedCount = useMemo(() => tasks.filter((t) => t.status === "done").length, [tasks]);
  const openCount = tasks.length - completedCount;
  const unscheduledCount = useMemo(() => tasks.filter((t) => !t.due_date && t.status !== "done").length, [tasks]);

  const handleStatusToggle = useCallback(
    async (task: TaskWithProject | Task) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: newStatus });
    },
    [updateTask]
  );

  const handleTaskClick = useCallback(
    (task: TaskWithProject | Task) => {
      const params = new URLSearchParams({ workspace: workspaceId });
      router.push(`/tasks/${task.id}?${params.toString()}`);
    },
    [router, workspaceId]
  );

  const currentSortLabel = TASK_SORT_OPTIONS.find(
    (o) => o.field === sortField && o.direction === sortDirection
  )?.label ?? "Sort";

  const currentDateLabel = DUE_DATE_FILTER_OPTIONS.find(
    (o) => o.value === dueDateFilter
  )?.label ?? "All dates";

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {openCount} open{completedCount > 0 ? `, ${completedCount} completed` : ""}
          {unscheduledCount > 0 ? ` · ${unscheduledCount} unscheduled` : ""}
        </p>
        <div className="flex items-center gap-1.5">
          {/* Due date filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={dueDateFilter !== "all" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {currentDateLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DUE_DATE_FILTER_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setDueDateFilter(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TASK_SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={`${option.field}:${option.direction}`}
                  onClick={() => {
                    setSortField(option.field);
                    setSortDirection(option.direction);
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Show/hide completed */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {showCompleted ? "Hide done" : "Show done"}
          </Button>
        </div>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            {tasks.length === 0
              ? "No tasks in this workspace yet."
              : dueDateFilter !== "all"
                ? `No ${currentDateLabel.toLowerCase()} tasks found.`
                : "All tasks are completed."}
          </p>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Tasks created in workspace projects will appear here."
              : dueDateFilter !== "all"
                ? "Try changing the date filter to see more tasks."
                : "Toggle \"Show done\" to see completed tasks."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          {filteredTasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onTaskClick={handleTaskClick}
              onStatusToggle={handleStatusToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
