/**
 * POST /api/ai/form-builder
 *
 * Developer-facing AI chat for creating feedback forms.
 * The developer describes the form they want in natural language;
 * the AI asks clarifying questions then generates a structured field definition.
 *
 * Model: Claude Sonnet 4.6 (developer-facing, structured JSON output quality matters)
 * Auth: Supabase session (developer)
 * Rate limit: aiExtraction bucket (5/min/user, same as task creation)
 * Max turns: 5 (same pattern as chat-task-creation)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit, createRateLimitResponse } from "@/lib/rate-limit/middleware";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL =
  process.env.FEEDBACK_BUILDER_MODEL ?? "claude-sonnet-4-6";
const AI_TIMEOUT = 30_000;

// ─── Request Schema ────────────────────────────────────────────────────────────

const formBuilderRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(12), // max 5 turns × 2 messages + initial
  context: z.object({
    projectId: z.string().uuid().optional(),
    projectTitle: z.string().max(200).optional(),
  }),
  turnCount: z.number().int().min(1).max(99),
});

// ─── Response Schema ───────────────────────────────────────────────────────────

const formFieldSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "textarea", "select", "radio", "checkbox", "url", "email"]),
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(50).optional(),
  placeholder: z.string().max(200).optional(),
});

const builderResponseSchema = z.union([
  z.object({
    type: z.literal("question"),
    content: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal("form"),
    message: z.string().min(1).max(500),
    fields: z.array(formFieldSchema).min(1).max(20),
  }),
]);

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  projectTitle: string | undefined,
  turnCount: number
): string {
  const contextLine = projectTitle
    ? `The developer is creating a feedback form for the project "${projectTitle}".`
    : "The developer is creating a feedback form.";

  const forceProposal =
    turnCount >= 5
      ? "\n\nIMPORTANT: You have asked enough questions. You MUST return a 'form' response now, even if you make reasonable assumptions about missing details. Do NOT ask another question."
      : "";

  return `You are a feedback form builder assistant. Your job is to help a developer create a structured feedback form based on their natural language description.

${contextLine}

You MUST respond ONLY with valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.

## Behavior
1. If the description is clear enough: immediately generate the form fields.
2. If you need clarification: ask exactly ONE focused question (e.g., "What severity levels should testers be able to select?" or "Should screenshot upload be required or optional?").
3. Ask at most one question per turn. After turn 5, always generate the form.

## Field Types Available
- "text" — single-line input
- "textarea" — multi-line input (good for descriptions, steps to reproduce)
- "select" — dropdown with predefined options
- "radio" — single choice from visible options
- "checkbox" — multiple choice from visible options
- "url" — URL input with validation
- "email" — email input with validation

## Field ID Rules
- Use snake_case, lowercase, no spaces (e.g., "steps_to_reproduce", "browser_version")
- IDs must be unique within the form

## Common Form Patterns
- Bug report: title, description, steps_to_reproduce, expected_behavior, actual_behavior, severity, browser, os, screenshot_url
- Feature request: title, description, use_case, priority
- General feedback: category, message, rating${forceProposal}

## Response Format (JSON only)

When you need clarification:
{"type":"question","content":"Your single focused question here"}

When you have enough information:
{"type":"form","message":"Here's your feedback form:","fields":[{"id":"bug_title","label":"Bug Title","type":"text","required":true,"placeholder":"Brief description of the issue"},{"id":"severity","label":"Severity","type":"select","required":true,"options":["Critical","High","Medium","Low"]}]}`;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate developer
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { type: "auth_error", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // 2. Rate limit (aiExtraction bucket — shared with task creation)
    const rateLimitCheck = await withRateLimit(request, user.id, "aiExtraction");
    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck);
    }

    // 3. Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
        { status: 400 }
      );
    }

    const validated = formBuilderRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "validation_error",
            message: validated.error.issues[0]?.message ?? "Invalid request",
          },
        },
        { status: 400 }
      );
    }

    const { messages, context, turnCount } = validated.data;

    // 4. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured", { feature: "form-builder", userId: user.id });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 5. Call Claude
    const aiResponse = await withTimeoutAndAbort(
      async (signal) => {
        const res = await fetch(CLAUDE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 2048,
            system: buildSystemPrompt(context.projectTitle, turnCount),
            messages,
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 429) {
            const retryAfter = res.headers.get("retry-after");
            return {
              error: {
                type: "rate_limit" as const,
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
              },
            };
          }
          return {
            error: {
              type: "api_error" as const,
              message: err.error?.message ?? `API error: ${res.status}`,
            },
          };
        }
        return res.json();
      },
      AI_TIMEOUT,
      "AI response timed out"
    );

    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error },
        { status: (aiResponse.error as { type: string }).type === "rate_limit" ? 429 : 502 }
      );
    }

    // 6. Extract text from Claude response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Unexpected AI response format" } },
        { status: 502 }
      );
    }

    // 7. Parse JSON
    let parsed: unknown;
    try {
      let text = contentBlock.text.trim();
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1].trim();
      parsed = JSON.parse(text);
    } catch {
      logger.error("Failed to parse AI form-builder response", {
        feature: "form-builder",
        userId: user.id,
        raw: contentBlock.text.slice(0, 500),
      });
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Failed to parse AI response" } },
        { status: 502 }
      );
    }

    // 8. Validate shape
    const validatedResponse = builderResponseSchema.safeParse(parsed);
    if (!validatedResponse.success) {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "AI response did not match expected format" } },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, ...validatedResponse.data });
  } catch (error) {
    logger.error("Form builder AI error", { feature: "form-builder", error });

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { success: false, error: { type: "timeout", message: "Request timed out. Please try again." } },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { success: false, error: { type: "api_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
