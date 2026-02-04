"use client";

import { useState } from "react";
import { SlidersHorizontal, LayoutGrid, List, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  TASK_SORT_OPTIONS,
  getSortOptionKey,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";
import type { ViewMode } from "@/components/layout";
import type { Project } from "@/types";

interface TaskFilterMenuProps {
  /** Current sort field */
  sortField: TaskSortField;
  /** Current sort direction */
  sortDirection: TaskSortDirection;
  /** Callback when sort changes */
  onSortChange: (field: TaskSortField, direction: TaskSortDirection) => void;
  /** Current view mode */
  viewMode?: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Available projects for filtering (optional) */
  projects?: Project[];
  /** Currently selected project IDs (optional) */
  selectedProjectIds?: string[];
  /** Callback when project filter changes (optional) */
  onProjectsChange?: (projectIds: string[]) => void;
}

export function TaskFilterMenu({
  sortField,
  sortDirection,
  onSortChange,
  viewMode,
  onViewModeChange,
  projects,
  selectedProjectIds = [],
  onProjectsChange,
}: TaskFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const currentSortKey = getSortOptionKey(sortField, sortDirection);

  // Check if any filters are active
  const hasActiveFilters =
    sortField !== "position" ||
    sortDirection !== "asc" ||
    selectedProjectIds.length > 0;

  const handleSortSelect = (field: TaskSortField, direction: TaskSortDirection) => {
    onSortChange(field, direction);
  };

  const toggleProject = (projectId: string) => {
    if (!onProjectsChange) return;
    if (selectedProjectIds.includes(projectId)) {
      onProjectsChange(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      onProjectsChange([...selectedProjectIds, projectId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5",
            hasActiveFilters && "border-primary text-primary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="text-xs">Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {(sortField !== "position" ? 1 : 0) + (selectedProjectIds.length > 0 ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {/* View Mode Section */}
        {viewMode && onViewModeChange && (
          <>
            <div className="p-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                View
              </Label>
              <div className="mt-2 flex gap-1">
                <Button
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 justify-start gap-2"
                  onClick={() => onViewModeChange("board")}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Board
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 justify-start gap-2"
                  onClick={() => onViewModeChange("list")}
                >
                  <List className="h-4 w-4" />
                  List
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Sort Section */}
        <div className="p-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sort by
          </Label>
          <div className="mt-2 space-y-1">
            {TASK_SORT_OPTIONS.map((option) => {
              const optionKey = getSortOptionKey(option.field, option.direction);
              const isSelected = currentSortKey === optionKey;
              return (
                <button
                  key={optionKey}
                  onClick={() => handleSortSelect(option.field, option.direction)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {option.label}
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Project Filter Section */}
        {projects && projects.length > 0 && onProjectsChange && (
          <>
            <Separator />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Projects
                </Label>
                {selectedProjectIds.length > 0 && (
                  <button
                    onClick={() => onProjectsChange([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {projects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 truncate text-left">
                        {project.title}
                      </span>
                      {isSelected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
