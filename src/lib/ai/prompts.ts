/**
 * AI Prompt Templates for Task Extraction
 */

import type { ExtractionSourceType, ExtractionEntity } from "./types";

/**
 * Build the system prompt. When entities are provided, adds entity linking rules.
 */
export function buildSystemPrompt(hasEntities: boolean): string {
  let prompt = `You are a task extraction assistant. Your job is to analyze text content and identify actionable tasks.

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
9. Include a "sourceText" field with the complete verbatim section, block, or passage from the source content that this task was derived from. Include the full relevant text — headings, bullet points, field definitions, and all — not just the opening sentence. Max 2000 characters.`;

  if (hasEntities) {
    prompt += `
10. For each task, identify which entities (by ID) the task relates to. Use the entity context provided to understand what each entity covers.
    - Link products and initiatives when the task is clearly about or affects that entity. Use the foundational context to understand what topics belong to each entity.
    - Link stakeholders ONLY when there is a clear dependency, follow-up action, approval needed, or deliverable involving that specific person or team. Do NOT link stakeholders just because they were mentioned — only when the task requires interaction with them.
    - A task can link to zero, one, or multiple entities.`;
  }

  prompt += `

## Output Format

Return a valid JSON object with this structure:
{
  "tasks": [
    {
      "title": "string (required, max 200 chars)",
      "description": "string or null (max 500 chars, AI-generated summary)",
      "priority": "low" | "medium" | "high" | "urgent",
      "suggestedDueDate": "string or null (preserve original phrasing like 'by Friday')",
      "confidence": 0.0-1.0,
      "sourceText": "string or null (complete verbatim section/passage from the source content that prompted this task, max 2000 chars)"${hasEntities ? `,
      "entityIds": ["array of entity ID strings this task relates to, or empty array"]` : ""}
    }
  ]
}

If no actionable tasks are found, return: { "tasks": [] }`;

  return prompt;
}

/** Keep the old constant for backwards compatibility during transition */
export const SYSTEM_PROMPT = buildSystemPrompt(false);

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
  entities?: ExtractionEntity[];
}

export function buildUserPrompt(params: UserPromptParams): string {
  const { sourceType, content, projectTitle, existingTaskTitles, entities } = params;
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

  if (entities && entities.length > 0) {
    prompt += `\n\n=== ENTITY CONTEXT ===\nThe following entities are mentioned in this content. For each extracted task, include the IDs of entities the task relates to.\n`;
    for (const entity of entities) {
      prompt += `\n[${entity.type.toUpperCase()}] ${entity.name} (ID: ${entity.id})`;
      if (entity.foundationalContext?.trim()) {
        // Truncate very long foundational context to keep prompt manageable
        const ctx = entity.foundationalContext.trim();
        const truncated = ctx.length > 1000 ? ctx.slice(0, 1000) + "..." : ctx;
        prompt += `\n${truncated}`;
      }
      prompt += "\n";
    }
  }

  return prompt;
}
