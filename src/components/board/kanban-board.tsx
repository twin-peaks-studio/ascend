"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCardDragOverlay } from "@/components/task";
import type { TaskWithProject, TaskStatus, Project } from "@/types";

interface KanbanBoardProps {
  tasks: TaskWithProject[];
  projects: Project[];
  onTasksChange: (tasks: TaskWithProject[]) => void;
  onTaskMove: (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number
  ) => Promise<boolean>;
  onAddTask?: (status: TaskStatus) => void;
  onEditTask?: (task: TaskWithProject) => void;
  onOpenDetails?: (task: TaskWithProject) => void;
  onDeleteTask?: (taskId: string) => void;
  onArchiveTask?: (taskId: string) => void;
  onMarkDuplicate?: (taskId: string, isDuplicate: boolean) => void;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export function KanbanBoard({
  tasks,
  onTasksChange,
  onTaskMove,
  onAddTask,
  onEditTask,
  onOpenDetails,
  onDeleteTask,
  onArchiveTask,
  onMarkDuplicate,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);

  // Configure drag sensors
  // MouseSensor for desktop - immediate drag with small distance threshold
  // TouchSensor for mobile/tablet - requires long press (300ms) to prevent accidental drags
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activating on desktop
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Require 300ms press before drag activates on touch devices
        tolerance: 5, // Allow 5px movement during the delay without canceling
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get tasks by status
  const getTasksByStatus = useCallback(
    (status: TaskStatus) => {
      return tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.position - b.position);
    },
    [tasks]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const task = tasks.find((t) => t.id === active.id);
      if (task) {
        setActiveTask(task);
      }
    },
    [tasks]
  );

  // Handle drag over (for column changes)
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the active task
      const activeTask = tasks.find((t) => t.id === activeId);
      if (!activeTask) return;

      // Check if we're over a column
      const isOverColumn = COLUMNS.some((col) => col.id === overId);

      if (isOverColumn) {
        const newStatus = overId as TaskStatus;

        // Only update if status changed
        if (activeTask.status !== newStatus) {
          // Optimistically update the task's status
          const updatedTasks = tasks.map((task) =>
            task.id === activeId ? { ...task, status: newStatus } : task
          );
          onTasksChange(updatedTasks);
        }
      } else {
        // We're over another task
        const overTask = tasks.find((t) => t.id === overId);
        if (!overTask) return;

        // If tasks are in different columns, move the active task to the over task's column
        if (activeTask.status !== overTask.status) {
          const updatedTasks = tasks.map((task) =>
            task.id === activeId
              ? { ...task, status: overTask.status }
              : task
          );
          onTasksChange(updatedTasks);
        }
      }
    },
    [tasks, onTasksChange]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeTask = tasks.find((t) => t.id === activeId);
      if (!activeTask) return;

      // Determine the target status
      let targetStatus: TaskStatus = activeTask.status;

      // Check if we're over a column
      const isOverColumn = COLUMNS.some((col) => col.id === overId);
      if (isOverColumn) {
        targetStatus = overId as TaskStatus;
      } else {
        // We're over another task
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          targetStatus = overTask.status;
        }
      }

      // Get tasks in the target column
      const columnTasks = tasks
        .filter((t) => t.status === targetStatus && t.id !== activeId)
        .sort((a, b) => a.position - b.position);

      // Find the new position
      let newPosition = 0;

      if (isOverColumn) {
        // Dropped directly on column - add to end
        newPosition = columnTasks.length;
      } else {
        // Dropped on a task - insert at that position
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          const overIndex = columnTasks.findIndex((t) => t.id === overId);
          newPosition = overIndex >= 0 ? overIndex : columnTasks.length;
        }
      }

      // Update local state with new positions
      const updatedTasks = tasks.map((task) => {
        if (task.id === activeId) {
          return { ...task, status: targetStatus, position: newPosition };
        }

        // Adjust positions of other tasks in the same column
        if (task.status === targetStatus) {
          const currentPos = columnTasks.findIndex((t) => t.id === task.id);
          if (currentPos >= newPosition) {
            return { ...task, position: currentPos + 1 };
          }
        }

        return task;
      });

      onTasksChange(updatedTasks);

      // Persist to database
      await onTaskMove(activeId, targetStatus, newPosition);
    },
    [tasks, onTasksChange, onTaskMove]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={[
          "flex h-[calc(100vh-10rem)] flex-nowrap gap-4 overflow-x-auto overflow-y-hidden pb-2",
          "md:grid md:grid-cols-3 md:overflow-visible md:pb-0",
        ].join(" ")}
      >
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex h-full min-w-[280px] shrink-0 flex-col md:min-w-0"
          >
            <KanbanColumn
              id={column.id}
              title={column.title}
              tasks={getTasksByStatus(column.id)}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onOpenDetails={onOpenDetails}
              onDeleteTask={onDeleteTask}
              onArchiveTask={onArchiveTask}
              onMarkDuplicate={onMarkDuplicate}
            />
          </div>
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? <TaskCardDragOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
