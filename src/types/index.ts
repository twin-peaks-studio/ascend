/**
 * Application Types
 *
 * These types extend the database types with relationships and
 * provide a cleaner interface for the application layer.
 */

// Re-export database types
export type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  Task,
  TaskInsert,
  TaskUpdate,
  ProjectDocument,
  ProjectDocumentInsert,
  ProjectDocumentUpdate,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  Attachment,
  AttachmentInsert,
  AttachmentUpdate,
  Note,
  NoteInsert,
  NoteUpdate,
  NoteTask,
  NoteTaskInsert,
  NoteTaskUpdate,
  Comment,
  CommentInsert,
  CommentUpdate,
  Notification,
  NotificationInsert,
  NotificationUpdate,
  ActivityLog,
  ActivityLogInsert,
  ActivityLogUpdate,
} from "./database";

import type {
  Project as DBProject,
  Task as DBTask,
  ProjectDocument as DBProjectDocument,
  Profile as DBProfile,
  Attachment as DBAttachment,
  Note as DBNote,
  Comment as DBComment,
  Notification as DBNotification,
  ActivityLog as DBActivityLog,
} from "./database";

/**
 * Project with all relations loaded
 */
export interface ProjectWithRelations extends DBProject {
  tasks: DBTask[];
  documents: DBProjectDocument[];
}

/**
 * Task with project relation loaded (project is optional)
 */
export interface TaskWithProject extends DBTask {
  project: DBProject | null;
  assignee?: DBProfile | null;
  attachments?: DBAttachment[];
}

/**
 * Note with project relation loaded
 */
export interface NoteWithProject extends DBNote {
  project: DBProject | null;
}

/**
 * Note with all relations loaded (project and linked tasks)
 */
export interface NoteWithRelations extends DBNote {
  project: DBProject | null;
  tasks: DBTask[];
}

/**
 * Comment with author profile loaded
 */
export interface CommentWithAuthor extends DBComment {
  author: DBProfile;
}

/**
 * Notification with actor profile loaded
 */
export interface NotificationWithActor extends DBNotification {
  actor: DBProfile;
}

/**
 * Activity log entry with actor profile loaded
 */
export interface ActivityLogWithActor extends DBActivityLog {
  actor: DBProfile | null;
}

/**
 * Activity action types tracked by database triggers
 */
export type ActivityAction =
  | "task_created"
  | "task_status_changed"
  | "task_priority_changed"
  | "task_assigned"
  | "task_deleted"
  | "comment_added"
  | "member_added"
  | "member_removed"
  | "project_updated"
  | "note_created"
  | "note_updated"
  | "note_deleted";

/**
 * Task status type for Kanban columns
 */
export type TaskStatus = "todo" | "in-progress" | "done";

/**
 * Task priority levels
 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/**
 * Project status type
 */
export type ProjectStatus = "active" | "completed" | "archived";

/**
 * Document type
 */
export type DocumentType = "link" | "document" | "note";

/**
 * Kanban column definition
 */
export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: TaskWithProject[];
}

/**
 * Available project colors for the UI
 */
export const PROJECT_COLORS = [
  "#3b82f6", // Blue (default)
  "#ef4444", // Red
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

/**
 * Priority configuration for UI display
 */
export const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  medium: {
    label: "Medium",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  high: {
    label: "High",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  urgent: {
    label: "Urgent",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
} as const;

/**
 * Todoist-style priority display (P1-P4 format) for compact views
 */
export const PRIORITY_DISPLAY_SHORT = {
  urgent: { label: "P1", color: "text-red-500" },
  high: { label: "P2", color: "text-orange-500" },
  medium: { label: "P3", color: "text-blue-500" },
  low: { label: "P4", color: "text-muted-foreground" },
} as const;

/**
 * Extended priority display with background colors for mobile/detailed views
 */
export const PRIORITY_DISPLAY_LONG = {
  urgent: { label: "Priority 1", color: "text-red-500", bgColor: "bg-red-500/10" },
  high: { label: "Priority 2", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  medium: { label: "Priority 3", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  low: { label: "Priority 4", color: "text-muted-foreground", bgColor: "bg-muted" },
} as const;

/**
 * Priority options array for select/dropdown components
 */
export const PRIORITY_OPTIONS = [
  { value: "urgent" as const, label: "Priority 1", color: "text-red-500" },
  { value: "high" as const, label: "Priority 2", color: "text-orange-500" },
  { value: "medium" as const, label: "Priority 3", color: "text-blue-500" },
  { value: "low" as const, label: "Priority 4", color: "text-muted-foreground" },
] as const;

/**
 * Status configuration for UI display
 */
export const STATUS_CONFIG = {
  todo: {
    label: "To Do",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  "in-progress": {
    label: "In Progress",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  done: {
    label: "Done",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
} as const;

/**
 * Project status configuration for UI display
 */
export const PROJECT_STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  completed: {
    label: "Completed",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  archived: {
    label: "Archived",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
} as const;
