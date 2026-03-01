"use client";

import { useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskListItem, type TaskListItemProps } from "./task-list-view";

interface SortableTaskListItemProps extends TaskListItemProps {
  id: string;
}

export function SortableTaskListItem({
  id,
  task,
  onTaskClick,
  onStatusToggle,
  assignee,
}: SortableTaskListItemProps) {
  const dragOccurred = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  useEffect(() => {
    if (isDragging) {
      dragOccurred.current = true;
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTaskClick = (clickedTask: typeof task) => {
    if (dragOccurred.current) {
      dragOccurred.current = false;
      return;
    }
    onTaskClick?.(clickedTask);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center",
        isDragging && "opacity-50 bg-muted/50 rounded"
      )}
    >
      {/* Drag handle */}
      <button
        className="shrink-0 px-1 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <TaskListItem
          task={task}
          onTaskClick={handleTaskClick}
          onStatusToggle={onStatusToggle}
          assignee={assignee}
        />
      </div>
    </div>
  );
}
