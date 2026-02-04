/**
 * Task Sorting Utilities
 *
 * Provides sorting options for tasks by due date and priority.
 */

import type { TaskWithProject, TaskPriority } from "@/types";
import type { Task } from "@/types/database";

export type TaskSortField = "position" | "due_date" | "priority";
export type TaskSortDirection = "asc" | "desc";

export interface TaskSortOption {
  field: TaskSortField;
  direction: TaskSortDirection;
  label: string;
}

/**
 * Available sorting options for tasks
 */
export const TASK_SORT_OPTIONS: TaskSortOption[] = [
  { field: "position", direction: "asc", label: "Default" },
  { field: "due_date", direction: "asc", label: "Due Date (earliest first)" },
  { field: "due_date", direction: "desc", label: "Due Date (latest first)" },
  { field: "priority", direction: "desc", label: "Priority (highest first)" },
  { field: "priority", direction: "asc", label: "Priority (lowest first)" },
];

/**
 * Priority values for sorting (higher number = higher priority)
 */
const PRIORITY_VALUES: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

/**
 * Get priority numeric value for sorting
 */
function getPriorityValue(priority: string): number {
  return PRIORITY_VALUES[priority as TaskPriority] ?? 0;
}

/**
 * Compare two dates for sorting (handles null values)
 * Null dates are sorted to the end when ascending, beginning when descending
 */
function compareDates(
  a: string | null,
  b: string | null,
  direction: TaskSortDirection
): number {
  // Both null - equal
  if (!a && !b) return 0;

  // Handle null values - null goes to end for asc, beginning for desc
  if (!a) return direction === "asc" ? 1 : -1;
  if (!b) return direction === "asc" ? -1 : 1;

  // Compare actual dates
  const dateA = new Date(a).getTime();
  const dateB = new Date(b).getTime();

  return direction === "asc" ? dateA - dateB : dateB - dateA;
}

/**
 * Compare two priorities for sorting
 */
function comparePriorities(
  a: string,
  b: string,
  direction: TaskSortDirection
): number {
  const valueA = getPriorityValue(a);
  const valueB = getPriorityValue(b);

  return direction === "asc" ? valueA - valueB : valueB - valueA;
}

/**
 * Sort tasks by the specified field and direction
 */
export function sortTasks<T extends TaskWithProject | Task>(
  tasks: T[],
  field: TaskSortField,
  direction: TaskSortDirection
): T[] {
  return [...tasks].sort((a, b) => {
    switch (field) {
      case "due_date":
        return compareDates(a.due_date, b.due_date, direction);
      case "priority":
        return comparePriorities(a.priority, b.priority, direction);
      case "position":
      default:
        return direction === "asc"
          ? a.position - b.position
          : b.position - a.position;
    }
  });
}

/**
 * Sort tasks with completed tasks always at the bottom
 * This is useful for list views where you want incomplete tasks first
 */
export function sortTasksWithCompletedLast<T extends TaskWithProject | Task>(
  tasks: T[],
  field: TaskSortField,
  direction: TaskSortDirection
): T[] {
  const incompleteTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  return [
    ...sortTasks(incompleteTasks, field, direction),
    ...sortTasks(completedTasks, field, direction),
  ];
}

/**
 * Get sort option key for localStorage persistence
 */
export function getSortOptionKey(
  field: TaskSortField,
  direction: TaskSortDirection
): string {
  return `${field}:${direction}`;
}

/**
 * Parse sort option key back to field and direction
 */
export function parseSortOptionKey(key: string): {
  field: TaskSortField;
  direction: TaskSortDirection;
} {
  const [field, direction] = key.split(":") as [TaskSortField, TaskSortDirection];
  return { field: field || "position", direction: direction || "asc" };
}
