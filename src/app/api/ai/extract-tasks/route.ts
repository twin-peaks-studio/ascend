/**
 * AI Task Extraction API Route
 *
 * Extracts actionable tasks from content (notes, descriptions) using Claude API.
 * Requires authentication and validates all inputs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractTasksRequestSchema,
  aiExtractionResponseSchema,
} from "@/lib/ai/validate-extraction";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { withTimeoutAndAbort, isTimeoutError } from "@/lib/utils/with-timeout";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit/middleware";
import type {
  ExtractTasksSuccessResponse,
  ExtractTasksErrorResponse,
} from "@/lib/ai/types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const AI_TIMEOUT = 15000; // 15 seconds

/**
 * POST /api/ai/extract-tasks
 *
 * Extracts tasks from provided content using Claude API.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractTasksSuccessResponse | ExtractTasksErrorResponse>> {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { type: "auth_error", message: "Unauthorized" },
        } as ExtractTasksErrorResponse,
        { status: 401 }
      );
    }

    // 2. Check rate limit (5 requests per minute per user)
    const rateLimitCheck = await withRateLimit(
      request,
      user.id,
      "aiExtraction"
    );

    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck);
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = extractTasksRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "invalid_response",
            message: validated.error.issues[0]?.message || "Invalid request",
          },
        } as ExtractTasksErrorResponse,
        { status: 400 }
      );
    }

    const { sourceType, content, projectTitle, existingTaskTitles } =
      validated.data;

    // 4. Check for empty content
    if (!content.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { type: "empty_content", message: "Content is empty" },
        } as ExtractTasksErrorResponse,
        { status: 400 }
      );
    }

    // 5. Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "api_error",
            message: "AI service not configured",
          },
        } as ExtractTasksErrorResponse,
        { status: 500 }
      );
    }

    // 6. Call Claude API with timeout
    const userPrompt = buildUserPrompt({
      sourceType,
      content,
      projectTitle,
      existingTaskTitles,
    });

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
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));

          // Handle rate limiting
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
              message:
                errorBody.error?.message || `API error: ${response.status}`,
              status: response.status,
            },
          };
        }

        return response.json();
      },
      AI_TIMEOUT,
      "AI task extraction timed out"
    );

    // Handle error responses from Claude
    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error } as ExtractTasksErrorResponse,
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    // 7. Parse Claude's response
    const contentBlock = aiResponse.content?.[0];
    if (!contentBlock || contentBlock.type !== "text") {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "invalid_response",
            message: "Unexpected response format from AI",
          },
        } as ExtractTasksErrorResponse,
        { status: 502 }
      );
    }

    // 8. Parse and validate the JSON response
    let parsedTasks;
    try {
      // Extract JSON from the response (Claude might include markdown code blocks)
      let jsonText = contentBlock.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      parsedTasks = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "invalid_response",
            message: "Failed to parse AI response as JSON",
          },
        } as ExtractTasksErrorResponse,
        { status: 502 }
      );
    }

    // 9. Validate the parsed response structure
    const validatedResponse = aiExtractionResponseSchema.safeParse(parsedTasks);
    if (!validatedResponse.success) {
      console.error(
        "AI response validation failed:",
        validatedResponse.error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "invalid_response",
            message: "AI response did not match expected format",
          },
        } as ExtractTasksErrorResponse,
        { status: 502 }
      );
    }

    // 10. Return successful response
    return NextResponse.json({
      success: true,
      tasks: validatedResponse.data.tasks,
      model: CLAUDE_MODEL,
      extractedAt: new Date().toISOString(),
    } as ExtractTasksSuccessResponse);
  } catch (error) {
    console.error("Task extraction error:", error);

    // Handle timeout errors
    if (isTimeoutError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: { type: "timeout", message: "Request timed out" },
        } as ExtractTasksErrorResponse,
        { status: 504 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: { type: "api_error", message: "Internal server error" },
      } as ExtractTasksErrorResponse,
      { status: 500 }
    );
  }
}
