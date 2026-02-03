/**
 * Zod Validation Schemas for AI Task Extraction
 */

import { z } from "zod";
import { taskPrioritySchema } from "../validation";

// ============================================
// Request Validation
// ============================================

export const extractionSourceTypeSchema = z.enum([
  "note",
  "task_description",
  "project_description",
]);

/**
 * Schema for extraction API request
 */
export const extractTasksRequestSchema = z.object({
  sourceType: extractionSourceTypeSchema,
  sourceId: z.string().uuid("Invalid source ID"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content too long"),
  projectId: z.string().uuid("Invalid project ID").optional(),
  projectTitle: z.string().max(200).optional(),
  existingTaskTitles: z.array(z.string().max(200)).max(100).optional(),
});

export type ExtractTasksRequestInput = z.infer<typeof extractTasksRequestSchema>;

// ============================================
// Response Validation (AI Output)
// ============================================

/**
 * Schema for a single extracted task from AI
 */
export const extractedTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable(),
  priority: taskPrioritySchema,
  suggestedDueDate: z.string().max(100).nullable(),
  confidence: z.number().min(0).max(1),
});

/**
 * Schema for AI response with tasks array
 */
export const aiExtractionResponseSchema = z.object({
  tasks: z.array(extractedTaskSchema).max(50), // Limit to prevent abuse
});

export type ExtractedTaskOutput = z.infer<typeof extractedTaskSchema>;
export type AIExtractionResponse = z.infer<typeof aiExtractionResponseSchema>;
