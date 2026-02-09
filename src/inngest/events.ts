/**
 * Inngest Event Definitions
 *
 * All events that trigger or cancel Inngest functions are defined here
 * with full type safety.
 */

export type Events = {
  /** Fired when a task is created with a due date, or an existing task's due date is set/changed. */
  "task/due-date.set": {
    data: {
      taskId: string;
      dueDate: string; // ISO 8601
      assigneeId: string;
      taskTitle: string;
      projectId: string | null;
    };
  };

  /** Fired when a task's due date changes. Cancels the previous sleeping reminder. */
  "task/due-date.updated": {
    data: {
      taskId: string;
    };
  };

  /** Fired when a task's due date is cleared (set to null). Cancels the sleeping reminder. */
  "task/due-date.removed": {
    data: {
      taskId: string;
    };
  };

  /** Fired when a task status changes to "done". Cancels the sleeping reminder. */
  "task/completed": {
    data: {
      taskId: string;
    };
  };

  /** Fired when a task is deleted. Cancels the sleeping reminder. */
  "task/deleted": {
    data: {
      taskId: string;
    };
  };
};
