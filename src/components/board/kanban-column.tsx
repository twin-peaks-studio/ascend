"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "@/components/task";
import type { TaskWithProject, TaskStatus } from "@/types";
import { STATUS_CONFIG } from "@/types";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: TaskWithProject[];
  onAddTask?: (status: TaskStatus) => void;
  onEditTask?: (task: TaskWithProject) => void;
  onOpenDetails?: (task: TaskWithProject) => void;
  onDeleteTask?: (taskId: string) => void;
  onArchiveTask?: (taskId: string) => void;
  onMarkDuplicate?: (taskId: string, isDuplicate: boolean) => void;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  onAddTask,
  onEditTask,
  onOpenDetails,
  onDeleteTask,
  onArchiveTask,
  onMarkDuplicate,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const statusConfig = STATUS_CONFIG[id];
  const taskIds = tasks.map((task) => task.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full flex-col rounded-lg border bg-muted/30",
        "transition-colors duration-200",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span
            className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium",
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddTask(id)}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add task to {title}</span>
          </Button>
        )}
      </div>

      {/* Tasks list */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onOpenDetails={onOpenDetails}
                onDelete={onDeleteTask}
                onArchive={onArchiveTask}
                onMarkDuplicate={onMarkDuplicate}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div
            className={cn(
              "flex h-24 items-center justify-center rounded-lg border-2 border-dashed",
              "text-sm text-muted-foreground",
              isOver && "border-primary/50 bg-primary/5"
            )}
          >
            {isOver ? "Drop here" : "No tasks"}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
