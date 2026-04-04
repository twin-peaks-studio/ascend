/**
 * AI Task Title Parser
 *
 * Single-shot endpoint: receives raw natural-language task input and returns
 * a clean, concise task title. Everything else (due date, priority) is
 * extracted client-side with zero-cost regex — only the title needs AI.
 *
 * Model: Claude Haiku (fast, cheap — ~100 tokens per call)
 * Fallback: caller uses fallbackTitle() from task-parse-utils if this fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit/middleware";
import { logger } from "@/lib/logger/logger";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5";
const AI_TIMEOUT = 10_000; // 10 s — title gen is fast

const SYSTEM_PROMPT =
  "Extract a task title from user input. Return ONLY the title (5-60 chars, no trailing punctuation). " +
  "Remove filler phrases like \"I need to\", \"I have to\", \"make sure to\". " +
  "Remove date references and priority phrases. Start with a verb when possible.";

const requestSchema = z.object({
  input: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimitCheck = await withRateLimit(request, user.id, "aiExtraction");
  if (!rateLimitCheck.allowed) {
    return createRateLimitResponse(rateLimitCheck);
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // ── Claude call ───────────────────────────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 80,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: body.input }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Claude API ${response.status}`);
    }

    const data = await response.json();
    const title = (data.content?.[0]?.text ?? "").trim();

    if (!title) throw new Error("Empty title response");

    return NextResponse.json({ title: title.substring(0, 200) });
  } catch (err) {
    logger.error("parse-task: AI call failed", { error: err });
    // Return 503 — client will fall back to fallbackTitle()
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }
}
