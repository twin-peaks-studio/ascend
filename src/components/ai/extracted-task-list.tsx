"use client";

/**
 * ExtractedTaskList Component
 *
 * Displays a list of extracted tasks with:
 * - Bulk selection controls
 * - Scrollable list area
 * - Selection count
 */

import { Button } from "@/components/ui/button";
import { ExtractedTaskItem } from "./extracted-task-item";
import type { ExtractedTask, ExtractionEntity } from "@/lib/ai/types";

interface ProjectOption {
  id: string;
  title: string;
}

interface ExtractedTaskListProps {
  tasks: ExtractedTask[];
  onUpdateTask: (id: string, updates: Partial<ExtractedTask>) => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** When provided, show per-task project selector (used for captures) */
  projects?: ProjectOption[];
  /** Available entities for linking */
  entities?: ExtractionEntity[];
  /** Full workspace entity list for manual linking */
  allEntities?: ExtractionEntity[];
}

export function ExtractedTaskList({
  tasks,
  onUpdateTask,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  projects,
  entities,
  allEntities,
}: ExtractedTaskListProps) {
  const selectedCount = tasks.filter((t) => t.selected).length;
  const allSelected = selectedCount === tasks.length;

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={allSelected ? onDeselectAll : onSelectAll}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedCount} of {tasks.length} selected
        </span>
      </div>

      {/* Task list - constrained height with overflow scroll */}
      <div className="max-h-[50vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          {tasks.map((task) => (
            <ExtractedTaskItem
              key={task.id}
              task={task}
              onUpdate={(updates) => onUpdateTask(task.id, updates)}
              onToggleSelection={() => onToggleSelection(task.id)}
              projects={projects}
              entities={entities}
              allEntities={allEntities}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
