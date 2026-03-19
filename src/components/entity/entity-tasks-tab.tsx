"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskListItem } from "@/components/task/task-list-view";
import { useEntityTasks } from "@/hooks/use-entity-tasks";
import { useTaskMutations } from "@/hooks/use-tasks";
import {
  sortTasksWithCompletedLast,
  TASK_SORT_OPTIONS,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";
import type { TaskWithProject, TaskStatus } from "@/types";
import type { Task } from "@/types/database";

interface EntityTasksTabProps {
  entityId: string;
}

export function EntityTasksTab({ entityId }: EntityTasksTabProps) {
  const router = useRouter();
  const { tasks, loading } = useEntityTasks(entityId);
  const { updateTask } = useTaskMutations();

  const [sortField, setSortField] = useState<TaskSortField>("priority");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("desc");
  const [showCompleted, setShowCompleted] = useState(false);

  const filteredTasks = useMemo(() => {
    const filtered = showCompleted ? tasks : tasks.filter((t) => t.status !== "done");
    return sortTasksWithCompletedLast(filtered, sortField, sortDirection);
  }, [tasks, showCompleted, sortField, sortDirection]);

  const completedCount = useMemo(() => tasks.filter((t) => t.status === "done").length, [tasks]);
  const openCount = tasks.length - completedCount;

  const handleStatusToggle = useCallback(
    async (task: TaskWithProject | Task) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: newStatus });
    },
    [updateTask]
  );

  const handleTaskClick = useCallback(
    (task: TaskWithProject | Task) => {
      router.push(`/tasks/${task.id}?from=entities`);
    },
    [router]
  );

  const currentSortLabel = TASK_SORT_OPTIONS.find(
    (o) => o.field === sortField && o.direction === sortDirection
  )?.label ?? "Sort";

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
        </p>
        <div className="flex items-center gap-1.5">
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
              ? "No tasks linked to this entity yet."
              : "All tasks are completed."}
          </p>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Tasks are linked during AI extraction from notes and captures."
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
