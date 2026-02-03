/**
 * Timer Storage Utility
 *
 * Manages localStorage persistence for the active timer state.
 * This ensures the timer UI survives page refreshes and mobile backgrounding.
 */

import type { TimeTrackingEntityType } from "@/types/database";

const STORAGE_KEY = "active-timer";

export interface ActiveTimerState {
  entryId: string;
  entityType: TimeTrackingEntityType;
  entityId: string;
  entityName: string; // Task/note/project title for display
  startTime: string; // ISO string
}

export const timerStorage = {
  /**
   * Get the current active timer state from localStorage
   */
  get(): ActiveTimerState | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as ActiveTimerState;

      // Validate the parsed object has required fields
      if (
        !parsed.entryId ||
        !parsed.entityType ||
        !parsed.entityId ||
        !parsed.startTime
      ) {
        timerStorage.clear();
        return null;
      }

      return parsed;
    } catch {
      // If parsing fails, clear corrupted data
      timerStorage.clear();
      return null;
    }
  },

  /**
   * Save the active timer state to localStorage
   */
  set(state: ActiveTimerState): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage might be full or disabled
      console.warn("Failed to save timer state to localStorage");
    }
  },

  /**
   * Clear the active timer state from localStorage
   */
  clear(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors when clearing
    }
  },
};
