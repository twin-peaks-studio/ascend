/**
 * AI Memory Refresh API Route
 *
 * POST /api/ai/memory-refresh
 *
 * Synthesizes an entity's ai_memory from three sources:
 * 1. Foundational context (permanent truths)
 * 2. Journal entries (evolving knowledge)
 * 3. Entity mentions (content from notes/captures that reference this entity)
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

interface MemoryRefreshSuccessResponse {
  success: true;
  aiMemory: string;
  refreshedAt: string;
  skipped: boolean;
  sources: {
    foundationalContext: boolean;
    journalEntries: number;
    mentions: number;
  };
}

interface MemoryRefreshErrorResponse {
  success: false;
  error: { type: string; message: string };
}

type MemoryRefreshResponse = MemoryRefreshSuccessResponse | MemoryRefreshErrorResponse;

function buildSystemPrompt(entityType: string, entityName: string, memoryGuidance: string | null): string {
  let prompt = `You are a product management intelligence system. Your job is to synthesize information about a specific ${entityType} called "${entityName}" into a clear, structured memory document.

You will receive three types of input:
1. **Foundational Context** — Permanent truths that the user has written about this ${entityType}. These are always correct and should be preserved verbatim or near-verbatim.
2. **Journal Entries** — Timestamped knowledge dumps. These may contain evolving opinions, decisions, updates, and observations.
3. **Mentioned Content** — Excerpts from notes and captures where this ${entityType} was mentioned via #hashtag. Use the Foundational Context to understand what topics, features, codenames, and concepts belong to "${entityName}", then extract ONLY the parts relevant to this ${entityType} — ignore unrelated content in these documents. Content may reference "${entityName}" indirectly using internal terminology, abbreviations, or feature names described in the Foundational Context.

Produce a structured memory document with these sections (skip any section that has no relevant content):

## Key Facts
Bullet points of confirmed, current facts about ${entityName}.

## Recent Decisions
Decisions that have been made, with dates if available.

## Open Questions
Unresolved questions, risks, or things that need answers.

## Stakeholder Notes
Key people involved and their positions/opinions (if any stakeholder info exists).

## Status & Progress
Current state of work, blockers, momentum.

## Action Items
Outstanding tasks or next steps mentioned across sources.

Rules:
- Be concise. Each bullet should be 1-2 sentences max.
- Use dates when available (from journal entry timestamps).
- If information conflicts across sources, note the conflict and which source is newer.
- Do NOT invent information. Only synthesize what's in the provided sources.
- Do NOT include meta-commentary about your process. Just output the memory document.
- Write in third person (e.g., "The team decided..." not "You decided...").`;

  if (memoryGuidance?.trim()) {
    prompt += `

=== USER CORRECTIONS & GUIDANCE (HIGH PRIORITY) ===
The user has provided the following corrections and guidance. These override any conflicting information from other sources. Always respect these instructions:

${memoryGuidance.trim()}`;
  }

  return prompt;
}

function buildUserPrompt(
  foundationalContext: string | null,
  journalEntries: Array<{ content: string; created_at: string }>,
  mentionedContent: Array<{ title: string; content: string; source_type: string }>
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

  if (parts.length === 0) {
    return "No sources available. There is no foundational context, no journal entries, and no mentions. Output a brief note that memory cannot be generated without source material.";
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
  memoryGuidance: string | null
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

    // 4. Fetch entity (use select("*") so optional columns like memory_guidance
    //    and memory_source_hash don't cause the query to fail if not yet migrated)
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("*")
      .eq("id", entityId)
      .single();

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

    // 7. Check we have at least some data
    const hasFoundational = !!entity.foundational_context?.trim();
    const journalCount = journalEntries?.length ?? 0;
    const mentionCount = mentionedContent.length;

    if (!hasFoundational && journalCount === 0 && mentionCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "no_sources",
            message: "No data available to synthesize. Add foundational context, journal entries, or mention this entity in notes/captures first.",
          },
        },
        { status: 400 }
      );
    }

    // 8. Compute source hash and check for changes
    //    memory_guidance and memory_source_hash are optional columns
    const memoryGuidance = entity.memory_guidance ?? null;
    const existingSourceHash = entity.memory_source_hash ?? null;

    const sourceHash = computeSourceHash(
      entity.foundational_context,
      journalEntries ?? [],
      mentionedContent,
      memoryGuidance
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
        },
      });
    }

    // 9. Check for API key
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

    // 10. Call Claude API
    const systemPrompt = buildSystemPrompt(entity.entity_type, entity.name, memoryGuidance);
    const userPrompt = buildUserPrompt(
      entity.foundational_context,
      journalEntries ?? [],
      mentionedContent
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

    // 11. Extract text from response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Unexpected AI response format" } },
        { status: 502 }
      );
    }

    const aiMemory = contentBlock.text.trim();
    const refreshedAt = new Date().toISOString();

    // 12. Store the synthesized memory on the entity
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
      sources: { foundationalContext: hasFoundational, journalEntries: journalCount, mentions: mentionCount },
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
