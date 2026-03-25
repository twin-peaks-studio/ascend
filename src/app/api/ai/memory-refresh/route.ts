/**
 * AI Memory Refresh API Route
 *
 * POST /api/ai/memory-refresh
 *
 * Synthesizes an entity's ai_memory from four sources:
 * 1. Foundational context (permanent truths)
 * 2. Journal entries (evolving knowledge)
 * 3. Entity mentions (content from notes/captures that reference this entity)
 * 4. Linked tasks (tasks connected via task_entities — title, status, description, context entries)
 *
 * The result is stored directly on the entity record (ai_memory + memory_refreshed_at).
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit/middleware";
import { logger } from "@/lib/logger/logger";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const AI_TIMEOUT = 120000; // 120 seconds — synthesis can be lengthy

interface MemoryRefreshRequest {
  entityId: string;
  force?: boolean;
}

interface LinkedTaskData {
  id: string;
  title: string;
  status: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  contextEntries: Array<{ content: string; created_at: string }>;
}

interface LinkedGoalData {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  taskCount: number;
  doneCount: number;
}

interface MemoryRefreshSuccessResponse {
  success: true;
  aiMemory: string;
  refreshedAt: string;
  skipped: boolean;
  sources: {
    foundationalContext: boolean;
    journalEntries: number;
    mentions: number;
    linkedTasks: number;
  };
}

interface MemoryRefreshErrorResponse {
  success: false;
  error: { type: string; message: string };
}

type MemoryRefreshResponse = MemoryRefreshSuccessResponse | MemoryRefreshErrorResponse;

function getEntityTypeGuidance(entityType: string, entityName: string): string {
  switch (entityType) {
    case "product":
      return `
You are writing a product briefing for a product manager about "${entityName}".

**Entity-specific guidance for the "Current State" section:**
Focus on strategic positioning, market context, feature-level momentum, adoption trends, competitive shifts, technical debt, and customer feedback themes. Think about what a PM needs to know before a leadership meeting about this product.

**Entity-specific guidance for the "Open Work" section:**
Summarize at the feature level, not the task level. "Payment integration is in progress" — not "Added stripe_customer_id column to organizations table." A task only deserves a mention if it represents a strategic blocker or milestone.

**Entity-specific guidance for the "Key Risks" section:**
Focus on strategic, competitive, and technical risks. Unresolved compliance issues, market threats, architectural debt, customer churn signals.`;

    case "initiative":
      return `
You are writing a progress report for a product manager about the initiative "${entityName}".

**Entity-specific guidance for the "Current State" section:**
Focus on progress toward the goal. What phase of execution is this in? What's been completed recently? Where is velocity strong or weak? Are there dependency chains at risk? If there's a deadline (from foundational context or journal), assess whether current pace will meet it.

**Entity-specific guidance for the "Open Work" section:**
Frame tasks as progress indicators. "5 of 12 tasks complete, 3 in progress, blocked on X" is useful. Translate task state into a narrative about momentum — are we accelerating, stalled, or blocked?

**Entity-specific guidance for the "Key Risks" section:**
Focus on timeline risk, blockers, dependency chains, and resource gaps. If tasks have been in-progress for a long time with no updates, flag that as a velocity risk. If to-do tasks have no assignee, flag that as a planning gap.`;

    case "stakeholder":
      return `
You are writing a relationship brief for a product manager about the stakeholder "${entityName}". This should read like preparation notes before a meeting with this person.

**Entity-specific guidance for the "Current State" section:**
Focus on the relationship: recent interactions, how the relationship is trending, what conversations are open, what they've asked for that hasn't been addressed, and any commitments made (by either side). If journal entries show a shift in sentiment or tone, note it.

**Entity-specific guidance for the "Open Work" section:**
Frame tasks as commitments and dependencies: what is this stakeholder waiting on? What was promised and by when? If a promised delivery date has passed and the task isn't done, call that out explicitly.

**Entity-specific guidance for the "Key Risks" section:**
Focus on relationship risk: undelivered promises, missed deadlines on commitments, signs of frustration or disengagement in journal entries, tasks the stakeholder is blocking.`;

    default:
      return `
You are writing a briefing for a product manager about the ${entityType} "${entityName}".

**Entity-specific guidance for the "Current State" section:**
Provide a comprehensive picture of what's happening with this ${entityType} right now.

**Entity-specific guidance for the "Open Work" section:**
Summarize task status as a narrative, focusing on what matters to a PM.

**Entity-specific guidance for the "Key Risks" section:**
Surface risks, blockers, and unresolved issues.`;
  }
}

function buildSystemPrompt(entityType: string, entityName: string, memoryGuidance: string | null): string {
  const entityGuidance = getEntityTypeGuidance(entityType, entityName);

  let prompt = `You are a product management intelligence system. Your job is to synthesize information about a specific ${entityType} called "${entityName}" into a structured memory document that helps a product manager make decisions.
${entityGuidance}

You will receive four types of input:
1. **Foundational Context** — Permanent truths that the user has written about this ${entityType}. These are always correct and should be preserved verbatim or near-verbatim.
2. **Journal Entries** — Timestamped knowledge dumps. These may contain evolving opinions, decisions, updates, and observations.
3. **Mentioned Content** — Excerpts from notes and captures where this ${entityType} was mentioned via #hashtag. These documents often discuss MULTIPLE entities/topics in a single note. Use the Foundational Context to understand what topics, features, codenames, and concepts belong to "${entityName}", then extract ONLY the parts relevant to this ${entityType} — strictly ignore everything else.
4. **Linked Tasks** — Tasks connected to this ${entityType}. You will receive a TASK SUMMARY (counts by status, urgency flags) and TASK DETAILS (only for in-progress, urgent, overdue, or recently completed tasks with context). Completed tasks without context entries have been pre-filtered out — they were routine work that doesn't inform the PM.

**Critical: The "so what" test.** Before including ANY piece of information, ask: "If a product manager removed this line, would they miss something important for their next decision or conversation?" If the answer is no, cut it. Implementation details, routine task completions, and resolved issues that don't change the strategic picture should be omitted.

**Critical: Topic boundary detection.** Notes frequently switch between topics. Pay close attention to language that signals a topic change — phrases like "separate from this", "unrelated to this", "on another note", "switching topics", "also", "moving on", or the introduction of a different #entity tag. When you encounter such a boundary, everything after it belongs to a DIFFERENT topic and must NOT be attributed to "${entityName}" unless it explicitly references "${entityName}" again. Conversely, if a later paragraph returns to discussing "${entityName}" (by name, abbreviation, or concepts from the Foundational Context), include that content.

Content may reference "${entityName}" indirectly using internal terminology, abbreviations, or feature names described in the Foundational Context.

Produce a structured memory document using EXACTLY these seven sections in this order. Omit a section entirely if it has no relevant content — do NOT include it with "None" or "N/A". Do NOT add any sections beyond these seven.

## Needs Attention
Urgent, overdue, or blocked items that require immediate PM action. Items here should have a clear reason for urgency (overdue due date, blocked dependency, stale in-progress work, undelivered commitment). If nothing qualifies, omit this section entirely.

## Summary
What this ${entityType} IS — a stable orientation paragraph (2-4 sentences). This should be relatively consistent across refreshes unless foundational facts change. Distill the foundational context into a concise overview.

## Current State
What's happening NOW. This section has no length limit — be as detailed as the source material warrants. If there are six important things happening, cover all six. If there's one, say one. Depth should match activity level. Synthesize across all sources (journal, mentions, tasks, context entries) to build a complete picture.

## Recent Decisions & Context
Decisions, observations, and key context from journal entries, typically from the last 2-4 weeks. Use dates. Bulleted list.

## Open Work
A narrative summary of task state — NOT a task list. State the ratio (e.g., "8 of 14 tasks complete") then describe only the in-progress, blocked, or notable items. Frame work in terms a PM cares about, not implementation details.

## Key Risks
Synthesized risks from all sources. Connect dots across sources — e.g., if a journal entry flags a concern AND related tasks are stalled, connect those facts. If no risks exist, omit this section.

## Week Ahead
What the PM should specifically focus on or act on in the next 7 days for this ${entityType}. Concrete and actionable — not a restatement of Open Work. Examples: a decision that needs to be made, a stakeholder conversation to have, a blocker to clear, a deadline arriving this week. Omit this section if there is nothing genuinely time-sensitive in the next 7 days.

Rules:
- Use dates when available (from journal entry timestamps or task context entry timestamps).
- If information conflicts across sources, note the conflict and which source is newer.
- Do NOT invent information. Only synthesize what's in the provided sources.
- Do NOT include content about other entities/products that happen to appear in the same document.
- Do NOT include meta-commentary about your process. Just output the memory document.
- Do NOT add sections beyond the seven defined above. No "Future Considerations", "Opportunities", "Action Items", or any other invented headings.
- Write in second person for stakeholders ("You committed to...") and third person for products and initiatives ("The team decided...").`;

  if (memoryGuidance?.trim()) {
    prompt += `

=== USER CORRECTIONS & GUIDANCE (HIGH PRIORITY) ===
The user has provided the following corrections and guidance. These override any conflicting information from other sources. Always respect these instructions:

${memoryGuidance.trim()}`;
  }

  return prompt;
}

/**
 * Filter and categorize linked tasks for the memory prompt.
 * - Completed tasks without context entries are excluded (routine noise)
 * - Remaining tasks are split into "notable" (detailed) and "completed" (summary only)
 * - Urgent/overdue tasks are flagged
 */
function categorizeLinkedTasks(linkedTasks: LinkedTaskData[]): {
  totalCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  urgentTasks: LinkedTaskData[];
  overdueTasks: LinkedTaskData[];
  notableTasks: LinkedTaskData[]; // in-progress, to-do, or done-with-context
  filteredOutCount: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const doneCount = linkedTasks.filter((t) => t.status === "done").length;
  const inProgressCount = linkedTasks.filter((t) => t.status === "in-progress").length;
  const todoCount = linkedTasks.filter((t) => t.status === "todo").length;

  // Filter: keep in-progress, to-do, and done-with-context-entries
  const notableTasks = linkedTasks.filter(
    (t) => t.status !== "done" || t.contextEntries.length > 0
  );
  const filteredOutCount = linkedTasks.length - notableTasks.length;

  // Flag urgent priority tasks (not done)
  const urgentTasks = notableTasks.filter(
    (t) => t.priority === "urgent" && t.status !== "done"
  );

  // Flag overdue tasks (due_date < today AND not done)
  const overdueTasks = notableTasks.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    const dueDate = new Date(t.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  });

  return {
    totalCount: linkedTasks.length,
    doneCount,
    inProgressCount,
    todoCount,
    urgentTasks,
    overdueTasks,
    notableTasks,
    filteredOutCount,
  };
}

function buildUserPrompt(
  foundationalContext: string | null,
  journalEntries: Array<{ content: string; created_at: string }>,
  mentionedContent: Array<{ title: string; content: string; source_type: string }>,
  linkedTasks: LinkedTaskData[],
  linkedGoals: LinkedGoalData[] = []
): string {
  const parts: string[] = [];

  // 1. Foundational context
  if (foundationalContext?.trim()) {
    parts.push(`=== FOUNDATIONAL CONTEXT ===\n${foundationalContext.trim()}`);
  }

  // 2. Journal entries (newest first)
  if (journalEntries.length > 0) {
    const entriesText = journalEntries
      .map((e) => {
        const date = new Date(e.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return `[${date}] ${e.content}`;
      })
      .join("\n\n");
    parts.push(`=== JOURNAL ENTRIES (${journalEntries.length}) ===\n${entriesText}`);
  }

  // 3. Mentioned content
  if (mentionedContent.length > 0) {
    const mentionsText = mentionedContent
      .map((m) => `[${m.source_type}: ${m.title}]\n${m.content}`)
      .join("\n\n---\n\n");
    parts.push(`=== MENTIONED IN ${mentionedContent.length} DOCUMENT(S) ===\n${mentionsText}`);
  }

  // 4. Linked goals — active goals scoped to this entity
  if (linkedGoals.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const goalsText = linkedGoals.map((g) => {
      const progress = g.taskCount > 0 ? `${g.doneCount}/${g.taskCount} tasks done` : "no tasks yet";
      const overdue = g.due_date && new Date(g.due_date) < today && g.status !== "completed";
      const dueLine = g.due_date
        ? `due ${new Date(g.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${overdue ? " ⚠ OVERDUE" : ""}`
        : "no due date";
      const lines = [`Goal: "${g.title}" (${dueLine}, ${progress}, status: ${g.status})`];
      if (g.description?.trim()) {
        lines.push(`Context: ${g.description.trim()}`);
      }
      return lines.join("\n");
    }).join("\n\n");
    parts.push(`=== ACTIVE GOALS (${linkedGoals.length}) ===\n${goalsText}`);
  }

  // 5. Linked tasks — summarized with urgency signals
  if (linkedTasks.length > 0) {
    const cats = categorizeLinkedTasks(linkedTasks);

    const statusLabel: Record<string, string> = {
      "todo": "To Do",
      "in-progress": "In Progress",
      "done": "Done",
    };

    // Task summary header
    const summaryLines: string[] = [];
    summaryLines.push(`Total: ${cats.totalCount} tasks — ${cats.doneCount} done, ${cats.inProgressCount} in progress, ${cats.todoCount} to do`);
    if (cats.filteredOutCount > 0) {
      summaryLines.push(`(${cats.filteredOutCount} completed tasks with no context entries were filtered out as routine completions)`);
    }

    // Urgency flags
    if (cats.urgentTasks.length > 0) {
      summaryLines.push(`\n⚠ URGENT PRIORITY (${cats.urgentTasks.length}): ${cats.urgentTasks.map((t) => `"${t.title}"`).join(", ")}`);
    }
    if (cats.overdueTasks.length > 0) {
      const overdueDetails = cats.overdueTasks.map((t) => {
        const dueDate = new Date(t.due_date!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `"${t.title}" (due ${dueDate})`;
      });
      summaryLines.push(`⚠ OVERDUE (${cats.overdueTasks.length}): ${overdueDetails.join(", ")}`);
    }

    // Detailed task data (only notable tasks)
    let taskDetails = "";
    if (cats.notableTasks.length > 0) {
      const detailsText = cats.notableTasks
        .map((t) => {
          const lines: string[] = [];
          const flags: string[] = [];
          if (t.priority === "urgent") flags.push("URGENT");
          if (t.due_date) {
            const dueDate = new Date(t.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (dueDate < today && t.status !== "done") {
              flags.push(`OVERDUE — due ${dueDateStr}`);
            } else {
              flags.push(`due ${dueDateStr}`);
            }
          }

          const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
          lines.push(`[${statusLabel[t.status] || t.status}] ${t.title}${flagStr}`);

          if (t.description?.trim()) {
            lines.push(`Description: ${htmlToPlainText(t.description)}`);
          }

          if (t.contextEntries.length > 0) {
            lines.push(`Context & Findings (${t.contextEntries.length}):`);
            for (const ce of t.contextEntries) {
              const date = new Date(ce.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              lines.push(`  - [${date}] ${ce.content}`);
            }
          }

          return lines.join("\n");
        })
        .join("\n\n---\n\n");
      taskDetails = `\n\nDetailed task data (${cats.notableTasks.length} notable tasks):\n${detailsText}`;
    }

    parts.push(`=== LINKED TASKS ===\n${summaryLines.join("\n")}${taskDetails}`);
  }

  if (parts.length === 0) {
    return "No sources available. There is no foundational context, no journal entries, no mentions, and no linked tasks. Output a brief note that memory cannot be generated without source material.";
  }

  return parts.join("\n\n\n");
}

/**
 * Compute a deterministic SHA-256 hash of all source material.
 * Used to detect when sources haven't changed since last refresh.
 */
function computeSourceHash(
  foundationalContext: string | null,
  journalEntries: Array<{ content: string; created_at: string }>,
  mentionedContent: Array<{ title: string; content: string; source_type: string }>,
  memoryGuidance: string | null,
  linkedTasks: LinkedTaskData[],
  linkedGoals: LinkedGoalData[] = []
): string {
  const hash = createHash("sha256");
  hash.update(foundationalContext ?? "");
  hash.update("\x00");
  // Sort entries by created_at for determinism
  const sortedEntries = [...journalEntries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const e of sortedEntries) {
    hash.update(e.content);
    hash.update(e.created_at);
    hash.update("\x00");
  }
  // Sort mentions by title for determinism
  const sortedMentions = [...mentionedContent].sort((a, b) => a.title.localeCompare(b.title));
  for (const m of sortedMentions) {
    hash.update(m.content);
    hash.update("\x00");
  }
  hash.update(memoryGuidance ?? "");
  hash.update("\x00");
  // Sort tasks by ID for determinism
  const sortedTasks = [...linkedTasks].sort((a, b) => a.id.localeCompare(b.id));
  for (const t of sortedTasks) {
    hash.update(t.id);
    hash.update(t.title);
    hash.update(t.status);
    hash.update(t.description ?? "");
    hash.update(t.due_date ?? "");
    hash.update(t.priority);
    // Sort context entries by created_at for determinism
    const sortedCE = [...t.contextEntries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const ce of sortedCE) {
      hash.update(ce.content);
      hash.update(ce.created_at);
    }
    hash.update("\x00");
  }
  // Sort goals by ID for determinism
  const sortedGoals = [...linkedGoals].sort((a, b) => a.id.localeCompare(b.id));
  for (const g of sortedGoals) {
    hash.update(g.id);
    hash.update(g.title);
    hash.update(g.status);
    hash.update(g.description ?? "");
    hash.update(g.due_date ?? "");
    hash.update(String(g.taskCount));
    hash.update(String(g.doneCount));
    hash.update("\x00");
  }
  return hash.digest("hex");
}

/**
 * Strip HTML tags and decode common entities to get plain text.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<MemoryRefreshResponse>> {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { type: "auth_error", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // 2. Rate limit (shared aiExtraction bucket)
    const rateLimitCheck = await withRateLimit(request, user.id, "aiExtraction");
    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck) as NextResponse<MemoryRefreshResponse>;
    }

    // 3. Parse request
    const body = await request.json();
    const { entityId, force } = body as MemoryRefreshRequest;

    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_request", message: "entityId is required" } },
        { status: 400 }
      );
    }

    // 4. Fetch entity — select("*") so optional columns (memory_guidance,
    //    memory_source_hash) don't break the query if migration hasn't run.
    interface EntityRow {
      id: string;
      workspace_id: string;
      entity_type: string;
      name: string;
      foundational_context: string | null;
      ai_memory: string | null;
      memory_refreshed_at: string | null;
      memory_guidance?: string | null;
      memory_source_hash?: string | null;
    }
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("*")
      .eq("id", entityId)
      .single() as unknown as { data: EntityRow | null; error: { code: string; message: string } | null };

    if (entityError || !entity) {
      logger.error("Entity lookup failed", {
        feature: "ai-memory-refresh",
        entityId,
        userId: user.id,
        entityError,
        entityData: entity,
      });
      return NextResponse.json(
        { success: false, error: { type: "not_found", message: "Entity not found" } },
        { status: 404 }
      );
    }

    // 5. Fetch journal entries
    const { data: journalEntries } = await supabase
      .from("entity_context_entries")
      .select("content, created_at")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    // 6. Fetch mentions → then fetch source content
    const { data: mentions } = await supabase
      .from("entity_mentions")
      .select("source_id, source_type")
      .eq("entity_id", entityId);

    let mentionedContent: Array<{ title: string; content: string; source_type: string }> = [];

    if (mentions && mentions.length > 0) {
      // Deduplicate source IDs
      const uniqueSources = new Map<string, string>();
      for (const m of mentions) {
        if (!uniqueSources.has(m.source_id)) {
          uniqueSources.set(m.source_id, m.source_type);
        }
      }

      const sourceIds = [...uniqueSources.keys()];

      // Fetch note/capture content (they share the same table)
      const { data: sources } = await supabase
        .from("notes")
        .select("id, title, content")
        .in("id", sourceIds);

      if (sources) {
        mentionedContent = sources
          .filter((s: { id: string; title: string; content: string | null }) => s.content?.trim())
          .map((s: { id: string; title: string; content: string | null }) => ({
            title: s.title || "Untitled",
            content: htmlToPlainText(s.content!),
            source_type: uniqueSources.get(s.id) || "note",
          }));
      }
    }

    // 7. Fetch linked tasks via task_entities junction table
    let linkedTasks: LinkedTaskData[] = [];

    const { data: taskEntityLinks } = await supabase
      .from("task_entities")
      .select("task_id")
      .eq("entity_id", entityId);

    if (taskEntityLinks && taskEntityLinks.length > 0) {
      const taskIds = taskEntityLinks.map((te: { task_id: string }) => te.task_id);

      // Fetch task details (including due_date and priority for urgency detection)
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, description, due_date, priority")
        .in("id", taskIds);

      if (tasks && tasks.length > 0) {
        // Fetch all context entries for these tasks in one query
        const { data: allContextEntries } = await supabase
          .from("task_context_entries")
          .select("task_id, content, created_at")
          .in("task_id", taskIds)
          .order("created_at", { ascending: false });

        // Group context entries by task_id
        const entriesByTask = new Map<string, Array<{ content: string; created_at: string }>>();
        if (allContextEntries) {
          for (const ce of allContextEntries) {
            const existing = entriesByTask.get(ce.task_id) || [];
            existing.push({ content: ce.content, created_at: ce.created_at });
            entriesByTask.set(ce.task_id, existing);
          }
        }

        linkedTasks = tasks.map((t: { id: string; title: string; status: string; description: string | null; due_date: string | null; priority: string }) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          description: t.description,
          due_date: t.due_date,
          priority: t.priority,
          contextEntries: entriesByTask.get(t.id) || [],
        }));
      }
    }

    // 8. Fetch linked goals (projects with type='goal' where entity_id matches)
    let linkedGoals: LinkedGoalData[] = [];
    const { data: goalProjects } = await supabase
      .from("projects")
      .select("id, title, description, due_date, status")
      .eq("entity_id", entityId)
      .eq("type", "goal")
      .neq("status", "archived");

    if (goalProjects && goalProjects.length > 0) {
      const goalIds = goalProjects.map((g: { id: string }) => g.id);
      const { data: goalTasks } = await supabase
        .from("tasks")
        .select("project_id, status")
        .in("project_id", goalIds)
        .eq("is_archived", false);

      const taskCountByGoal = new Map<string, { total: number; done: number }>();
      if (goalTasks) {
        for (const t of goalTasks as { project_id: string; status: string }[]) {
          const counts = taskCountByGoal.get(t.project_id) ?? { total: 0, done: 0 };
          counts.total++;
          if (t.status === "done") counts.done++;
          taskCountByGoal.set(t.project_id, counts);
        }
      }

      linkedGoals = goalProjects.map((g: { id: string; title: string; description: string | null; due_date: string | null; status: string }) => {
        const counts = taskCountByGoal.get(g.id) ?? { total: 0, done: 0 };
        return {
          id: g.id,
          title: g.title,
          description: g.description,
          due_date: g.due_date,
          status: g.status,
          taskCount: counts.total,
          doneCount: counts.done,
        };
      });
    }

    // 9. Check we have at least some data
    const hasFoundational = !!entity.foundational_context?.trim();
    const journalCount = journalEntries?.length ?? 0;
    const mentionCount = mentionedContent.length;
    const taskCount = linkedTasks.length;

    if (!hasFoundational && journalCount === 0 && mentionCount === 0 && taskCount === 0 && linkedGoals.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "no_sources",
            message: "No data available to synthesize. Add foundational context, journal entries, mention this entity in notes/captures, or link tasks first.",
          },
        },
        { status: 400 }
      );
    }

    // 10. Compute source hash and check for changes
    //    memory_guidance and memory_source_hash are optional columns
    const memoryGuidance = entity.memory_guidance ?? null;
    const existingSourceHash = entity.memory_source_hash ?? null;

    const sourceHash = computeSourceHash(
      entity.foundational_context,
      journalEntries ?? [],
      mentionedContent,
      memoryGuidance,
      linkedTasks,
      linkedGoals
    );

    if (!force && existingSourceHash === sourceHash && entity.ai_memory) {
      return NextResponse.json({
        success: true,
        aiMemory: entity.ai_memory,
        refreshedAt: entity.memory_refreshed_at ?? new Date().toISOString(),
        skipped: true,
        sources: {
          foundationalContext: hasFoundational,
          journalEntries: journalCount,
          mentions: mentionCount,
          linkedTasks: taskCount,
        },
      });
    }

    // 10. Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured", {
        feature: "ai-memory-refresh",
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 11. Call Claude API
    const systemPrompt = buildSystemPrompt(entity.entity_type, entity.name, memoryGuidance);
    const userPrompt = buildUserPrompt(
      entity.foundational_context,
      journalEntries ?? [],
      mentionedContent,
      linkedTasks,
      linkedGoals
    );

    const aiResponse = await withTimeoutAndAbort(
      async (signal) => {
        const response = await fetch(CLAUDE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));

          if (response.status === 429) {
            return {
              error: {
                type: "rate_limit",
                message: "AI rate limit exceeded. Please try again later.",
              },
            };
          }

          return {
            error: {
              type: "api_error",
              message: errorBody.error?.message || `API error: ${response.status}`,
            },
          };
        }

        return response.json();
      },
      AI_TIMEOUT,
      "AI memory refresh timed out"
    );

    // Handle error responses from Claude
    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error } as MemoryRefreshErrorResponse,
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    // 12. Extract text from response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Unexpected AI response format" } },
        { status: 502 }
      );
    }

    const aiMemory = contentBlock.text.trim();
    const refreshedAt = new Date().toISOString();

    // 13. Store the synthesized memory on the entity
    //     Only include memory_source_hash if the column exists (was migrated)
    const updatePayload: Record<string, string> = {
      ai_memory: aiMemory,
      memory_refreshed_at: refreshedAt,
      updated_at: refreshedAt,
    };
    if ("memory_source_hash" in entity) {
      updatePayload.memory_source_hash = sourceHash;
    }
    const { error: updateError } = await supabase
      .from("entities")
      .update(updatePayload)
      .eq("id", entityId);

    if (updateError) {
      logger.error("Failed to save AI memory", {
        feature: "ai-memory-refresh",
        entityId,
        error: updateError,
      });
      return NextResponse.json(
        { success: false, error: { type: "db_error", message: "Failed to save memory" } },
        { status: 500 }
      );
    }

    logger.info("AI memory refreshed", {
      feature: "ai-memory-refresh",
      entityId,
      entityName: entity.name,
      sources: { foundationalContext: hasFoundational, journalEntries: journalCount, mentions: mentionCount, linkedTasks: taskCount },
    });

    return NextResponse.json({
      success: true,
      aiMemory,
      refreshedAt,
      skipped: false,
      sources: {
        foundationalContext: hasFoundational,
        journalEntries: journalCount,
        mentions: mentionCount,
        linkedTasks: taskCount,
      },
    });
  } catch (error) {
    logger.error("Memory refresh error", {
      feature: "ai-memory-refresh",
      error,
    });

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { success: false, error: { type: "timeout", message: "Request timed out" } },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { success: false, error: { type: "api_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
