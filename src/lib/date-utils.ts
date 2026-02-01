/**
 * Date formatting utilities for consistent date display.
 */
import { format, isToday, isTomorrow, isPast } from "date-fns";

/**
 * Format a due date for display.
 * Shows "Today", "Tomorrow", or "MMM d" format.
 */
export function formatDueDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isToday(dateObj)) return "Today";
  if (isTomorrow(dateObj)) return "Tomorrow";
  return format(dateObj, "MMM d");
}

/**
 * Check if a date is overdue (past and not today).
 */
export function isOverdue(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return isPast(dateObj) && !isToday(dateObj);
}
