/**
 * AI Prompt Templates for Task Extraction
 */

import type { ExtractionSourceType } from "./types";

/**
 * System prompt that defines the AI's role and output format
 */
export const SYSTEM_PROMPT = `You are a task extraction assistant. Your job is to analyze text content and identify actionable tasks.

## Rules

1. Extract ONLY clear, actionable items - not vague ideas or general notes
2. Each task title should be concise and under 200 characters
3. Descriptions should provide helpful context, max 500 characters
4. Infer priority based on urgency indicators:
   - "ASAP", "urgent", "critical", "immediately" → urgent
   - "important", "high priority", "soon" → high
   - "when possible", "eventually", "nice to have" → low
   - Default to "medium" when unclear
5. Do NOT extract:
   - Items that appear to be completed (checkboxes marked done, crossed out, "done", "completed")
   - General observations or notes that aren't tasks
   - Questions that don't imply action needed
6. Preserve the original intent - don't paraphrase excessively
7. If dates are mentioned (e.g., "by Friday", "next week", "March 15"), include in suggestedDueDate
8. Assign a confidence score (0.0-1.0) based on how clearly the item is a task

## Output Format

Return a valid JSON object with this structure:
{
  "tasks": [
    {
      "title": "string (required, max 200 chars)",
      "description": "string or null (max 500 chars)",
      "priority": "low" | "medium" | "high" | "urgent",
      "suggestedDueDate": "string or null (preserve original phrasing like 'by Friday')",
      "confidence": 0.0-1.0
    }
  ]
}

If no actionable tasks are found, return: { "tasks": [] }`;

/**
 * Source type labels for user-friendly prompts
 */
const SOURCE_LABELS: Record<ExtractionSourceType, string> = {
  note: "note",
  task_description: "task description",
  project_description: "project description",
};

/**
 * Build user prompt with content and context
 */
export interface UserPromptParams {
  sourceType: ExtractionSourceType;
  content: string;
  projectTitle?: string;
  existingTaskTitles?: string[];
}

export function buildUserPrompt(params: UserPromptParams): string {
  const { sourceType, content, projectTitle, existingTaskTitles } = params;
  const sourceLabel = SOURCE_LABELS[sourceType];

  let prompt = `Extract actionable tasks from this ${sourceLabel}:

---
${content}
---`;

  if (projectTitle) {
    prompt += `\n\nProject context: "${projectTitle}"`;
  }

  if (existingTaskTitles && existingTaskTitles.length > 0) {
    prompt += `\n\nExisting tasks in this project (avoid creating duplicates):\n${existingTaskTitles.map((t) => `- ${t}`).join("\n")}`;
  }

  return prompt;
}
