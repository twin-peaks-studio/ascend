/**
 * Zod Validation Schemas
 *
 * These schemas validate all user input before it reaches the database.
 * They provide runtime type safety and help prevent invalid data.
 *
 * SECURITY NOTES:
 * - All string inputs have max length limits to prevent DoS
 * - URLs are validated and sanitized
 * - No HTML or script content is allowed in text fields
 */

import { z } from "zod";
import { sanitizeStringPreserveChars, sanitizeUrl } from "./security/sanitize";

// ============================================
// Common Validators
// ============================================

/**
 * Safe required string that gets sanitized and has reasonable length limits.
 * Uses sanitizeStringPreserveChars to avoid double-escaping (React handles HTML escaping on render).
 */
const safeRequiredString = (maxLength: number = 500) =>
  z
    .string()
    .min(1, "This field is required")
    .max(maxLength, `Must be ${maxLength} characters or less`)
    .transform((val) => sanitizeStringPreserveChars(val));

/**
 * Safe optional string that gets sanitized.
 * Uses sanitizeStringPreserveChars to avoid double-escaping (React handles HTML escaping on render).
 */
const safeOptionalString = (maxLength: number = 2000) =>
  z
    .string()
    .max(maxLength, `Must be ${maxLength} characters or less`)
    .transform((val) => sanitizeStringPreserveChars(val))
    .nullable()
    .optional();

/**
 * Safe optional long-form text (for descriptions, notes, etc.) with no practical limit.
 * Sanitized but allows very large content for living documents.
 */
const safeLongText = () =>
  z
    .string()
    .transform((val) => sanitizeStringPreserveChars(val))
    .nullable()
    .optional();

/**
 * Safe URL that gets validated and sanitized
 */
const safeUrl = z
  .string()
  .max(2000, "URL must be 2000 characters or less")
  .transform((val) => sanitizeUrl(val))
  .nullable()
  .optional();

// ============================================
// Project Schemas
// ============================================

export const projectStatusSchema = z.enum(["active", "completed", "archived"]);

export const projectColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
  .default("#3b82f6");

export const projectPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  title: safeRequiredString(100),
  description: safeLongText(),
  status: projectStatusSchema.default("active"),
  priority: projectPrioritySchema.default("medium"),
  color: projectColorSchema,
  lead_id: z.string().uuid("Invalid lead ID").nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
});

/**
 * Schema for updating an existing project
 */
export const updateProjectSchema = z.object({
  title: safeRequiredString(100).optional(),
  description: safeLongText(),
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional(),
  color: projectColorSchema.optional(),
  lead_id: z.string().uuid("Invalid lead ID").nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
});

// ============================================
// Task Schemas
// ============================================

export const taskStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

/**
 * Schema for creating a new task
 */
export const createTaskSchema = z.object({
  project_id: z.string().uuid("Invalid project ID").nullable().optional(),
  title: safeRequiredString(200),
  description: safeOptionalString(5000),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  position: z.number().int().min(0).default(0),
  due_date: z.string().datetime().nullable().optional(),
  assignee_id: z.string().uuid("Invalid assignee ID").nullable().optional(),
});

/**
 * Schema for updating an existing task
 */
export const updateTaskSchema = z.object({
  project_id: z.string().uuid("Invalid project ID").nullable().optional(),
  title: safeRequiredString(200).optional(),
  description: safeOptionalString(5000),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  is_duplicate: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  due_date: z.string().datetime().nullable().optional(),
  assignee_id: z.string().uuid("Invalid assignee ID").nullable().optional(),
});

/**
 * Schema for updating task position (drag-and-drop)
 */
export const updateTaskPositionSchema = z.object({
  id: z.string().uuid("Invalid task ID"),
  status: taskStatusSchema,
  position: z.number().int().min(0),
});

// ============================================
// Document Schemas
// ============================================

export const documentTypeSchema = z.enum(["link", "document", "note"]);

/**
 * Schema for creating a new document
 */
export const createDocumentSchema = z
  .object({
    project_id: z.string().uuid("Invalid project ID"),
    title: safeRequiredString(200),
    url: safeUrl,
    content: safeOptionalString(10000),
    type: documentTypeSchema.default("link"),
  })
  .refine(
    (data) => {
      // Links must have a URL
      if (data.type === "link" && !data.url) {
        return false;
      }
      // Notes must have content
      if (data.type === "note" && !data.content) {
        return false;
      }
      return true;
    },
    {
      message: "Links require a URL, notes require content",
    }
  );

/**
 * Schema for updating an existing document
 */
export const updateDocumentSchema = z.object({
  title: safeRequiredString(200).optional(),
  url: safeUrl,
  content: safeOptionalString(10000),
  type: documentTypeSchema.optional(),
});

// ============================================
// Note Schemas
// ============================================

/**
 * Schema for creating a new note
 */
export const createNoteSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  title: safeRequiredString(200),
  content: safeOptionalString(50000), // Allow longer content for rich notes
});

/**
 * Schema for updating an existing note
 */
export const updateNoteSchema = z.object({
  title: safeRequiredString(200).optional(),
  content: safeOptionalString(50000),
});

/**
 * Schema for linking a task to a note
 */
export const createNoteTaskSchema = z.object({
  note_id: z.string().uuid("Invalid note ID"),
  task_id: z.string().uuid("Invalid task ID"),
});

// ============================================
// Type Exports
// ============================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskPositionInput = z.infer<typeof updateTaskPositionSchema>;

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateNoteTaskInput = z.infer<typeof createNoteTaskSchema>;
