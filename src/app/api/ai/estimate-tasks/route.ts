/**
 * AI Task Estimation API Route
 *
 * Estimates time required for tasks using Claude API.
 * Returns per-task time estimates and a day completion likelihood.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit/middleware";
import { logger } from "@/lib/logger/logger";
import { z } from "zod";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const AI_TIMEOUT = 60000; // 60 seconds

const estimateRequestSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(200),
        description: z.string().max(1000).nullable(),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        projectName: z.string().max(200).nullable(),
      })
    )
    .min(1)
    .max(50),
  remainingMinutesInDay: z.number().min(0).max(1440),
});

const ESTIMATION_SYSTEM_PROMPT = `You are a productivity assistant that estimates how long tasks will take.

Given a list of tasks, return a realistic time estimate for each one and an overall assessment of whether the user can complete everything today.

Rules:
1. Be realistic and slightly conservative — most people underestimate task time
2. Account for context switching (add 5–10% overhead when there are many tasks)
3. Use priority as a signal: urgent tasks are usually more complex
4. If a description is provided, use it to refine your estimate
5. Keep estimates practical: minimum 5 minutes, maximum 4 hours per task
6. The "message" field should be a single plain-English sentence summarizing the day

Return ONLY valid JSON in this exact structure:
{
  "estimates": [
    {
      "id": "task-id-string",
      "estimatedMinutes": 30,
      "confidence": 0.8
    }
  ],
  "summary": {
    "totalMinutes": 150,
    "completionLikelihood": 0.75,
    "message": "You have about 2.5 hours of work with 4 hours remaining — very achievable."
  }
}`;

export async function POST(request: NextRequest) {
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
    const rateLimitCheck = await withRateLimit(request, user.id, "aiEstimation");
    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck);
    }

    // 3. Validate request
    const body = await request.json();
    const validated = estimateRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: { type: "validation_error", message: validated.error.issues[0]?.message || "Invalid request" } },
        { status: 400 }
      );
    }

    const { tasks, remainingMinutesInDay } = validated.data;

    // 4. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured", { feature: "ai-task-estimation", userId: user.id });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 5. Build prompt
    const remainingHours = (remainingMinutesInDay / 60).toFixed(1);
    const taskList = tasks
      .map(
        (t, i) =>
          `${i + 1}. [id:${t.id}] [${t.priority.toUpperCase()}] ${t.title}${t.projectName ? ` (Project: ${t.projectName})` : ""}${t.description ? `\n   Context: ${t.description.slice(0, 300)}` : ""}`
      )
      .join("\n");

    const userPrompt = `Estimate the time needed for each task. The user has ${remainingHours} hours remaining today.\n\nTasks:\n${taskList}`;

    // 6. Call Claude
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
            system: ESTIMATION_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          if (response.status === 429) {
            return { error: { type: "rate_limit" as const, message: "Rate limit exceeded. Please try again later." } };
          }
          return { error: { type: "api_error" as const, message: errorBody.error?.message || `API error: ${response.status}` } };
        }

        return response.json();
      },
      AI_TIMEOUT,
      "AI task estimation timed out"
    );

    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error },
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    // 7. Parse response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Unexpected response format from AI" } },
        { status: 502 }
      );
    }

    let parsed;
    try {
      let jsonText = contentBlock.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1];
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "Failed to parse AI response as JSON" } },
        { status: 502 }
      );
    }

    // 8. Basic validation of response shape
    if (!Array.isArray(parsed?.estimates) || !parsed?.summary) {
      return NextResponse.json(
        { success: false, error: { type: "invalid_response", message: "AI response did not match expected format" } },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, estimates: parsed.estimates, summary: parsed.summary });
  } catch (error) {
    logger.error("Task estimation error", { feature: "ai-task-estimation", error });

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
