"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Section } from "@/types";

interface SectionHeaderProps {
  section: Section;
  taskCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddTask: () => void;
  isDragDisabled?: boolean;
}

export function SectionHeader({
  section,
  taskCount,
  isCollapsed,
  onToggleCollapse,
  onRename,
  onDelete,
  onAddTask,
  isDragDisabled = false,
}: SectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(section.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section-${section.id}`,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== section.name) {
      onRename(trimmed);
    } else {
      setEditValue(section.name);
    }
    setIsEditing(false);
  }, [editValue, section.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmitRename();
      } else if (e.key === "Escape") {
        setEditValue(section.name);
        setIsEditing(false);
      }
    },
    [handleSubmitRename, section.name]
  );

  const startEditing = useCallback(() => {
    setEditValue(section.name);
    setIsEditing(true);
  }, [section.name]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 py-2 px-2 bg-muted/50 border-b border-border/60 rounded-t-md",
        "group/section",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <button
        className="shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition-colors active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Section name */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmitRename}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 text-sm font-semibold bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
          maxLength={100}
        />
      ) : (
        <button
          onClick={startEditing}
          className="flex-1 min-w-0 text-left text-sm font-semibold truncate hover:text-foreground/80 transition-colors"
        >
          {section.name}
        </button>
      )}

      {/* Task count badge */}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {taskCount}
      </span>

      {/* Add task button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onAddTask();
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={startEditing}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
