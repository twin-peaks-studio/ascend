/**
 * POST /api/forms/[slug]/followup
 *
 * Tester-facing AI follow-up chat after form submission.
 * The AI evaluates submission completeness and asks up to 3 clarifying questions.
 * On completion (or after 3 questions), returns a generated task title + final contents.
 *
 * Model: Claude Haiku (fast, cost-efficient; scales with submission volume)
 * Auth: Form session cookie (not Supabase auth)
 * Rate limit: IP-based, formFollowup bucket
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { withRateLimit, createRateLimitResponse } from "@/lib/rate-limit/middleware";
import { getFormSession } from "@/lib/forms/session";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger";
import type { FormField } from "@/types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL =
  process.env.FEEDBACK_REVIEW_MODEL ?? "claude-haiku-4-5-20251001";
const AI_TIMEOUT = 30_000;
const MAX_QUESTIONS = 3;

// ─── Request Schema ────────────────────────────────────────────────────────────

const followupRequestSchema = z.object({
  submissionId: z.string().uuid(),
  /** Full conversation so far: user answers to previous AI questions */
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .max(MAX_QUESTIONS * 2 + 2), // initial + 3 Q&A pairs max
  /** How many questions the AI has asked so far (0 on first call) */
  questionCount: z.number().int().min(0).max(MAX_QUESTIONS),
});

// ─── Response Schema ───────────────────────────────────────────────────────────

const followupResponseSchema = z.union([
  z.object({
    type: z.literal("question"),
    content: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal("complete"),
    taskTitle: z.string().min(1).max(200),
    // Coerce any scalar value to string — AI may return numbers or booleans
    finalContents: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
        .transform((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
    ),
  }),
]);

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  formTitle: string,
  fields: FormField[],
  rawContents: Record<string, string | string[]>,
  questionCount: number
): string {
  const fieldSummary = fields
    .map((f) => {
      const value = rawContents[f.id];
      const displayValue = Array.isArray(value) ? value.join(", ") : value ?? "(not provided)";
      return `- ${f.label}: ${displayValue}`;
    })
    .join("\n");

  const forceComplete =
    questionCount >= MAX_QUESTIONS
      ? `\n\nIMPORTANT: You have asked ${MAX_QUESTIONS} questions. You MUST now return a "complete" response — do NOT ask another question. Make reasonable inferences from the information provided.`
      : "";

  return `You are a feedback review assistant for "${formTitle}".

A tester has submitted this feedback:
${fieldSummary}

Your role:
1. Assess whether the submission has enough detail to be actionable as a bug report or feature request.
2. If critical information is missing (e.g., steps to reproduce, expected vs actual behavior, browser/OS), ask ONE focused follow-up question.
3. If the submission is sufficiently complete, or after clarifications, generate a concise task title and confirm completion.

Rules:
- Ask at most ONE question per turn. Be specific and focused.
- Never ask about information already provided.
- Generate task titles in this format: "[Type]: [Brief description]" where Type is Bug, Feature, or Feedback.
- Keep task titles under 80 characters.${forceComplete}

You MUST respond ONLY with valid JSON — no markdown, no extra text.

When you need clarification:
{"type":"question","content":"Your single focused question here"}

When you have enough information:
{"type":"complete","taskTitle":"Bug: Login button unresponsive on Safari iOS","finalContents":{"summary":"Combined answer incorporating all provided info"}}`;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // 1. Validate session cookie
  const session = getFormSession(request, slug);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { type: "unauthenticated", message: "No valid session" } },
      { status: 401 }
    );
  }

  // 2. Rate limit by IP
  const rateLimitCheck = await withRateLimit(request, null, "formFollowup");
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

  const validated = followupRequestSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "validation_error", message: validated.error.issues[0]?.message ?? "Invalid request" },
      },
      { status: 400 }
    );
  }

  const { submissionId, messages, questionCount } = validated.data;

  // 4. Fetch submission + form
  const supabase = createServiceClient();
  const { data: submission, error: subError } = await supabase
    .from("feedback_submissions")
    .select("id, form_id, raw_contents, task_id")
    .eq("id", submissionId)
    .eq("form_id", session.formId)
    .single();

  if (subError || !submission) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Submission not found" } },
      { status: 404 }
    );
  }

  const { data: form } = await supabase
    .from("feedback_forms")
    .select("title, fields")
    .eq("id", submission.form_id)
    .single();

  if (!form) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Form not found" } },
      { status: 404 }
    );
  }

  // 5. Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error("ANTHROPIC_API_KEY not configured", { feature: "feedback-followup" });
    return NextResponse.json(
      { success: false, error: { type: "api_error", message: "AI service not configured" } },
      { status: 500 }
    );
  }

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(
    form.title,
    (form.fields as unknown as FormField[]) ?? [],
    submission.raw_contents as Record<string, string | string[]>,
    questionCount
  );

  // 7. Call Claude
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
          max_tokens: 512,
          system: systemPrompt,
          // First call (no messages yet): seed with a trigger so the AI evaluates
          messages:
            messages.length > 0
              ? messages
              : [{ role: "user", content: "Please review my submission." }],
        }),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) {
          return { error: { type: "rate_limit", message: "AI rate limit reached. Try again later." } };
        }
        return { error: { type: "api_error", message: err.error?.message ?? `API error ${res.status}` } };
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

  // 8. Parse Claude response
  const contentBlock = aiResponse.content?.[0];
  if (!contentBlock || contentBlock.type !== "text") {
    return NextResponse.json(
      { success: false, error: { type: "invalid_response", message: "Unexpected AI response format" } },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    let text = contentBlock.text.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    parsed = JSON.parse(text);
  } catch {
    logger.error("Failed to parse AI followup response", {
      feature: "feedback-followup",
      raw: contentBlock.text.slice(0, 300),
    });
    return NextResponse.json(
      { success: false, error: { type: "invalid_response", message: "Failed to parse AI response" } },
      { status: 502 }
    );
  }

  const validatedResponse = followupResponseSchema.safeParse(parsed);
  if (!validatedResponse.success) {
    logger.error("AI followup response schema validation failed", {
      feature: "feedback-followup",
      parsed,
      issues: validatedResponse.error.issues,
    });
    return NextResponse.json(
      { success: false, error: { type: "invalid_response", message: "AI response did not match expected format" } },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, ...validatedResponse.data });
}
