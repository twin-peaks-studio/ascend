/**
 * Date formatting utilities for consistent date display.
 */
import { format, isToday, isTomorrow, isPast } from "date-fns";

/**
 * Format a due date for display.
 * Shows "Today", "Tomorrow", or "MMM d" format.
 * Appends time (e.g., "at 2:00 PM") when hours/minutes are non-zero.
 */
export function formatDueDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const hasTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
  const timeSuffix = hasTime ? ` at ${format(dateObj, "h:mm a")}` : "";

  if (isToday(dateObj)) return `Today${timeSuffix}`;
  if (isTomorrow(dateObj)) return `Tomorrow${timeSuffix}`;
  return format(dateObj, "MMM d") + timeSuffix;
}

/**
 * Check if a date is overdue (past and not today).
 */
export function isOverdue(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return isPast(dateObj) && !isToday(dateObj);
}
