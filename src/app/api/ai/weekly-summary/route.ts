/**
 * Weekly Focus Summary API Route
 *
 * POST /api/ai/weekly-summary
 *
 * Reads existing ai_memory from all entities in a workspace and synthesizes
 * a weekly focus summary answering: "What should I focus on this week?"
 *
 * Does NOT trigger new memory refreshes — relies on previously generated ai_memory.
 */

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
const AI_TIMEOUT = 60000; // 60 seconds

interface WeeklySummaryRequest {
  workspaceId: string;
}

interface WeeklySummarySuccessResponse {
  success: true;
  summary: string;
  entityCount: number;
}

interface WeeklySummaryErrorResponse {
  success: false;
  error: { type: string; message: string };
}

type WeeklySummaryResponse = WeeklySummarySuccessResponse | WeeklySummaryErrorResponse;

const SYSTEM_PROMPT = `You are a strategic planning assistant for a product manager. Your job is to synthesize memory documents across multiple entities (products, initiatives, stakeholders) from a single workspace into a concise weekly focus briefing.

The user is asking: "What should I focus on this week?"

Your output must answer that question directly and concisely. Structure your response as follows:

## This Week's Focus

A single paragraph (3–5 sentences) identifying the 2–3 most important areas of focus for the week. Lead with the highest-stakes item. Be direct — this is a decision aid, not a report.

## Priority Actions

A bulleted list (5–8 bullets max) of the most important specific actions the PM should take this week. Each bullet should be actionable and tied to a specific entity or theme. Format: "**[Entity/Theme]** — [action or decision needed]". Only include items that would make a material difference if done this week.

## Watch Closely

A bulleted list (3–5 bullets max) of items that need monitoring but may not require immediate action — things that could escalate, deadlines approaching, or relationships that need attention. Format: "**[Entity/Theme]** — [what to watch and why]".

Rules:
- Do NOT include a section if there is nothing meaningful to put in it.
- Do NOT pad with low-priority items. It is better to have 3 sharp bullets than 8 vague ones.
- Do NOT repeat information across sections.
- Do NOT invent information — only synthesize from the provided entity memories.
- If entity memories are stale or empty, acknowledge this briefly in the focus paragraph.
- Keep the entire output under 400 words.`;

function buildUserPrompt(
  entities: Array<{ name: string; entity_type: string; ai_memory: string | null; memory_refreshed_at: string | null }>
): string {
  const parts: string[] = [];

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  parts.push(`Today is ${todayStr}.`);
  parts.push(`You have ${entities.length} entities across this workspace.\n`);

  for (const entity of entities) {
    const typeLabel = entity.entity_type.charAt(0).toUpperCase() + entity.entity_type.slice(1);
    const refreshedLabel = entity.memory_refreshed_at
      ? new Date(entity.memory_refreshed_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "never";

    if (!entity.ai_memory?.trim()) {
      parts.push(`=== ${typeLabel.toUpperCase()}: ${entity.name} (memory last refreshed: ${refreshedLabel}) ===\n[No memory generated yet]`);
    } else {
      parts.push(`=== ${typeLabel.toUpperCase()}: ${entity.name} (memory last refreshed: ${refreshedLabel}) ===\n${entity.ai_memory.trim()}`);
    }
  }

  return parts.join("\n\n");
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<WeeklySummaryResponse>> {
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

    // 2. Rate limit
    const rateLimitCheck = await withRateLimit(request, user.id, "aiExtraction");
    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck) as NextResponse<WeeklySummaryResponse>;
    }

    // 3. Parse request
    const body = await request.json();
    const { workspaceId } = body as WeeklySummaryRequest;

    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_request", message: "workspaceId is required" } },
        { status: 400 }
      );
    }

    // 4. Verify user has access to this workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { type: "forbidden", message: "Access denied to this workspace" } },
        { status: 403 }
      );
    }

    // 5. Fetch all entities with their ai_memory
    const { data: entities, error: entitiesError } = await supabase
      .from("entities")
      .select("id, name, entity_type, ai_memory, memory_refreshed_at")
      .eq("workspace_id", workspaceId)
      .order("entity_type", { ascending: true })
      .order("name", { ascending: true });

    if (entitiesError) {
      logger.error("Error fetching entities for weekly summary", {
        feature: "ai-weekly-summary",
        workspaceId,
        error: entitiesError,
      });
      return NextResponse.json(
        { success: false, error: { type: "db_error", message: "Failed to load entities" } },
        { status: 500 }
      );
    }

    if (!entities || entities.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "no_entities",
            message: "No entities found in this workspace. Create products, initiatives, or stakeholders and generate their memory first.",
          },
        },
        { status: 400 }
      );
    }

    // 6. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 7. Call Claude
    const userPrompt = buildUserPrompt(entities);

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
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          if (response.status === 429) {
            return { error: { type: "rate_limit", message: "AI rate limit exceeded. Please try again later." } };
          }
          return { error: { type: "api_error", message: errorBody.error?.message || `API error: ${response.status}` } };
        }

        return response.json();
      },
      AI_TIMEOUT,
      "Weekly summary timed out"
    );

    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error } as WeeklySummaryErrorResponse,
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Unexpected AI response format" } },
        { status: 502 }
      );
    }

    logger.info("Weekly summary generated", {
      feature: "ai-weekly-summary",
      workspaceId,
      entityCount: entities.length,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      summary: contentBlock.text.trim(),
      entityCount: entities.length,
    });
  } catch (error) {
    logger.error("Weekly summary error", { feature: "ai-weekly-summary", error });

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
