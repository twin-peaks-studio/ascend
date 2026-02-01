"use client";

import { useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Copy, Archive, Trash2, Pencil, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TaskWithProject } from "@/types";
import { PRIORITY_CONFIG } from "@/types";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";

interface TaskCardProps {
  task: TaskWithProject;
  onEdit?: (task: TaskWithProject) => void;
  onDelete?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
  onMarkDuplicate?: (taskId: string, isDuplicate: boolean) => void;
  onOpenDetails?: (task: TaskWithProject) => void;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onArchive,
  onMarkDuplicate,
  onOpenDetails,
  isDragging = false,
}: TaskCardProps) {
  const dragOccurred = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  // Track when drag starts
  useEffect(() => {
    if (isSortableDragging) {
      dragOccurred.current = true;
    }
  }, [isSortableDragging]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't open if we were dragging
    if (dragOccurred.current) {
      dragOccurred.current = false;
      return;
    }

    // Don't open if clicking on interactive elements (buttons, menus)
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest('[role="menu"]')) {
      return;
    }

    onOpenDetails?.(task);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isCurrentlyDragging = isDragging || isSortableDragging;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing touch-pan-x",
        "transition-all duration-200 py-0 gap-0",
        isCurrentlyDragging && "opacity-50 shadow-lg scale-105 rotate-2",
        "hover:shadow-md"
      )}
    >
      <div className="p-3">
        {/* Header row with drag handle and actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Drag handle - visual indicator only */}
          <div className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight line-clamp-2">
              {task.title}
            </p>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Task actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onMarkDuplicate && (
                <DropdownMenuItem
                  onClick={() => onMarkDuplicate(task.id, !task.is_duplicate)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {task.is_duplicate ? "Remove duplicate" : "Mark as duplicate"}
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem onClick={() => onArchive(task.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(task.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        {/* Footer with badges and metadata */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <Badge
            variant="secondary"
            className={cn("text-xs", priorityConfig.color, priorityConfig.bgColor)}
          >
            {priorityConfig.label}
          </Badge>

          {/* Due date badge */}
          {task.due_date && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                isOverdue(task.due_date) && "border-destructive text-destructive"
              )}
            >
              <Calendar className="h-3 w-3 mr-1" />
              {formatDueDate(task.due_date)}
            </Badge>
          )}

          {/* Duplicate badge */}
          {task.is_duplicate && (
            <Badge variant="outline" className="text-xs">
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Badge>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Assignee avatar */}
          {task.assignee && (
            <Avatar
              className="h-5 w-5"
              title={task.assignee.display_name || task.assignee.email || "Assigned"}
            >
              <AvatarImage src={task.assignee.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(task.assignee.display_name, task.assignee.email)}
              </AvatarFallback>
            </Avatar>
          )}

          {/* Project indicator */}
          {task.project && (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: task.project.color }}
              title={task.project.title}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Dragging overlay version of the card
 */
export function TaskCardDragOverlay({ task }: { task: TaskWithProject }) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <Card className="shadow-xl rotate-3 cursor-grabbing py-0 gap-0">
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="font-medium text-sm leading-tight flex-1 line-clamp-2">
            {task.title}
          </p>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn("text-xs", priorityConfig.color, priorityConfig.bgColor)}
          >
            {priorityConfig.label}
          </Badge>
          {task.is_duplicate && (
            <Badge variant="outline" className="text-xs">
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
