/**
 * AI Conversational Task Creation API Route
 *
 * Multi-turn chat endpoint that helps users create tasks through natural language.
 * The AI classifies input as simple (immediate proposal) or complex (asks one
 * clarifying question per turn, max 5 turns). Returns either a question or
 * structured task proposals for user approval.
 *
 * Model: Claude Haiku (fast, cost-efficient for short conversational turns)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit/middleware";
import { logger } from "@/lib/logger/logger";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
// Use Claude Haiku — fast and cost-effective for short conversational turns
const CLAUDE_MODEL = "claude-haiku-4-5";
const AI_TIMEOUT = 30000; // 30 seconds

// ─── Request Schema ────────────────────────────────────────────────────────────

const chatTaskCreationRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(10), // max 5 turns × 2 messages each
  context: z.object({
    projectId: z.string().uuid().optional(),
    projectTitle: z.string().max(200).optional(),
    currentPath: z.string().max(500),
    /** Client's local date in YYYY-MM-DD — avoids UTC timezone skew */
    clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  turnCount: z.number().int().min(1).max(99),
});

// ─── Response Schema ───────────────────────────────────────────────────────────

const chatResponseSchema = z.union([
  z.object({
    type: z.literal("question"),
    content: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal("tasks"),
    message: z.string().min(1).max(500),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(2000).nullable(),
          priority: z.enum(["low", "medium", "high", "urgent"]),
          dueDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable(),
        })
      )
      .min(1)
      .max(10),
  }),
]);

// ─── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  projectTitle?: string,
  turnCount?: number,
  clientDate?: string
): string {
  // Prefer the client's local date to avoid UTC timezone skew.
  // Fall back to server UTC if the client didn't send a date.
  const today = clientDate ?? new Date().toISOString().split("T")[0];
  const [year, month, day] = today.split("-");
  const todayReadable = new Date(
    parseInt(year), parseInt(month) - 1, parseInt(day)
  ).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const contextLine = projectTitle
    ? `The user is currently working in a project called "${projectTitle}". Tasks you propose will be created in this project.`
    : "The user has no specific project context. Tasks will be created without a project.";

  const forceProposal =
    turnCount !== undefined && turnCount >= 3
      ? "\n\nIMPORTANT: You have already asked enough questions. You MUST return tasks now, even if you have to make reasonable assumptions about missing details. Do NOT ask another question."
      : "";

  return `You are a task creation assistant. Your job is to help users create well-structured tasks from their natural language input.

You MUST respond ONLY with valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.

## Today's Date
Today is ${todayReadable} (${today}). All due dates must be on or after today.
Use this to correctly calculate relative dates:
- "tomorrow" = ${new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day) + 1)).toISOString().split("T")[0]}
- "next week" = the same weekday next week (7 days from today)
- "end of this week" = the coming Friday
- "end of next week" = the Friday of next week
- "this month" = the last day of ${todayReadable.split(" ")[1]} ${year}
Never use dates from past years. If unsure of a specific date, return null for dueDate.

## Context
${contextLine}

## Classification Rules
- SIMPLE: A single, clear, actionable task where you have enough information immediately. Examples: "Buy coffee beans", "Call dentist tomorrow", "Fix the login bug"
- COMPLEX: Input that is ambiguous about what the actual task is, implies multiple distinct tasks, or is missing critical information. Examples: "Mom's birthday", "quarterly review prep", "handle the server issue"

## Conversation Rules
1. For SIMPLE input: Immediately return tasks — do NOT ask questions
2. For COMPLEX input: Ask exactly ONE focused, specific question to clarify the most important unknown
3. Ask about "what" before "when" — understanding what needs to be done matters more than timing
4. Break complex goals into multiple specific tasks when appropriate (max 5 tasks)${forceProposal}

## Priority Guidelines
- "urgent/ASAP/critical/emergency/today" → "urgent"
- "important/high priority/soon/this week" → "high"
- Normal work tasks → "medium"
- "someday/nice to have/when I get to it" → "low"

## Response Format (JSON only — no other text)

When you need clarification:
{"type":"question","content":"Your single focused question here"}

When you have enough information:
{"type":"tasks","message":"Brief confirmation (e.g. 'Here are 3 tasks to get you started:')","tasks":[{"title":"Concise, action-oriented task title","description":"Optional additional context or null","priority":"medium","dueDate":"YYYY-MM-DD or null"}]}`;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate user
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

    // 2. Check rate limit (reuses aiExtraction bucket — 5 req/min/user)
    const rateLimitCheck = await withRateLimit(
      request,
      user.id,
      "aiExtraction"
    );

    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck);
    }

    // 3. Parse and validate request
    const body = await request.json();
    const validated = chatTaskCreationRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "validation_error",
            message: validated.error.issues[0]?.message || "Invalid request",
          },
        },
        { status: 400 }
      );
    }

    const { messages, context, turnCount } = validated.data;

    // 4. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured", {
        feature: "ai-chat-task-creation",
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 5. Build system prompt (injects project context + turn-limit enforcement)
    const systemPrompt = buildSystemPrompt(context.projectTitle, turnCount, context.clientDate);

    // 6. Call Claude API
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
            system: systemPrompt,
            messages,
          }),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));

          if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after");
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
              message: errorBody.error?.message || `API error: ${response.status}`,
            },
          };
        }

        return response.json();
      },
      AI_TIMEOUT,
      "AI response timed out"
    );

    // Handle upstream errors
    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error },
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    // 7. Extract text from Claude response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        {
          success: false,
          error: { type: "invalid_response", message: "Unexpected response format from AI" },
        },
        { status: 502 }
      );
    }

    // 8. Parse JSON response (strip markdown code fences if present)
    let parsed;
    try {
      let jsonText = contentBlock.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      parsed = JSON.parse(jsonText);
    } catch {
      logger.error("Failed to parse AI response as JSON", {
        feature: "ai-chat-task-creation",
        userId: user.id,
        rawResponse: contentBlock.text.slice(0, 500),
      });
      return NextResponse.json(
        {
          success: false,
          error: { type: "invalid_response", message: "Failed to parse AI response" },
        },
        { status: 502 }
      );
    }

    // 9. Validate response shape
    const validatedResponse = chatResponseSchema.safeParse(parsed);
    if (!validatedResponse.success) {
      logger.error("AI response failed schema validation", {
        feature: "ai-chat-task-creation",
        userId: user.id,
        issues: validatedResponse.error.issues,
      });
      return NextResponse.json(
        {
          success: false,
          error: { type: "invalid_response", message: "AI response did not match expected format" },
        },
        { status: 502 }
      );
    }

    // 10. Return validated response
    return NextResponse.json({ success: true, ...validatedResponse.data });
  } catch (error) {
    logger.error("Chat task creation error", {
      feature: "ai-chat-task-creation",
      error,
    });

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
