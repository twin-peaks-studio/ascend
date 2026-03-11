/**
 * AI Text Extraction API Route
 *
 * Extracts text from image or PDF attachments using Claude's vision/document API.
 * Only accessible to authenticated users who own or are members of the note's project.
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
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const AI_TIMEOUT = 30000; // 30 seconds

const EXTRACTABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const EXTRACTION_SYSTEM_PROMPT = `You are a document OCR assistant. Extract all readable text from the provided file exactly as it appears.
Preserve formatting cues (line breaks, bullet points, section headings) using markdown.
Return only the extracted text — no commentary, no preamble, no explanation.
If no text is readable, return an empty string.`;

type ExtractTextError = {
  type:
    | "auth_error"
    | "validation_error"
    | "not_found"
    | "not_extractable"
    | "api_error"
    | "timeout"
    | "rate_limit";
  message: string;
  retryAfter?: number;
};

type ExtractTextResponse =
  | { success: true; extracted_text: string }
  | { success: false; error: ExtractTextError };

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractTextResponse>> {
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

    // 2. Rate limit check
    const rateLimitCheck = await withRateLimit(request, user.id, "aiExtraction");
    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck) as NextResponse<ExtractTextResponse>;
    }

    // 3. Parse request body
    const body = await request.json().catch(() => null);
    if (!body || typeof body.attachment_id !== "string" || !body.attachment_id) {
      return NextResponse.json(
        {
          success: false,
          error: { type: "validation_error", message: "attachment_id is required" },
        },
        { status: 400 }
      );
    }

    const attachmentId: string = body.attachment_id;

    // 4. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured", {
        feature: "ai-text-extraction",
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "AI service not configured" } },
        { status: 500 }
      );
    }

    // 5. Fetch attachment and verify ownership
    // For notes: join to confirm user created the note or is a project member
    const { data: attachment, error: fetchError } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json(
        { success: false, error: { type: "not_found", message: "Attachment not found" } },
        { status: 404 }
      );
    }

    // Verify ownership based on entity type
    if (attachment.entity_type === "note") {
      const { data: noteData, error: noteError } = await supabase
        .from("notes")
        .select("created_by, project_id")
        .eq("id", attachment.entity_id)
        .single();

      if (noteError || !noteData) {
        return NextResponse.json(
          { success: false, error: { type: "not_found", message: "Note not found" } },
          { status: 404 }
        );
      }

      const isOwner = noteData.created_by === user.id;
      if (!isOwner) {
        // Check project membership
        const { data: membership } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", noteData.project_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membership) {
          return NextResponse.json(
            { success: false, error: { type: "auth_error", message: "Access denied" } },
            { status: 403 }
          );
        }
      }
    } else if (attachment.entity_type === "task") {
      // For tasks, verify via project membership (tasks belong to projects)
      const { data: taskData } = await supabase
        .from("tasks")
        .select("created_by")
        .eq("id", attachment.entity_id)
        .single();

      if (!taskData || taskData.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: { type: "auth_error", message: "Access denied" } },
          { status: 403 }
        );
      }
    }

    // 6. Verify file is extractable
    if (!EXTRACTABLE_MIME_TYPES.has(attachment.mime_type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: "not_extractable",
            message: `File type ${attachment.mime_type} is not supported for text extraction. Supported types: images (JPEG, PNG, GIF, WebP) and PDF.`,
          },
        },
        { status: 422 }
      );
    }

    // 7. Download file from Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("attachments")
      .download(attachment.file_path);

    if (downloadError || !fileBlob) {
      logger.error("Failed to download attachment for extraction", {
        attachmentId,
        filePath: attachment.file_path,
        error: downloadError,
      });
      return NextResponse.json(
        { success: false, error: { type: "api_error", message: "Failed to download file" } },
        { status: 502 }
      );
    }

    // 8. Convert to base64
    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = attachment.mime_type as string;

    // 9. Build Claude message content block
    const contentBlock =
      mimeType === "application/pdf"
        ? {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data,
            },
          };

    // 10. Call Claude API with timeout
    const aiResponse = await withTimeoutAndAbort(
      async (signal) => {
        const response = await fetch(CLAUDE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "pdfs-2024-09-25",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            system: EXTRACTION_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: [
                  contentBlock,
                  { type: "text", text: "Please extract all text from this file." },
                ],
              },
            ],
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
      "Text extraction timed out"
    );

    if ("error" in aiResponse) {
      return NextResponse.json(
        { success: false, error: aiResponse.error as ExtractTextError },
        { status: aiResponse.error.type === "rate_limit" ? 429 : 502 }
      );
    }

    // 11. Extract text from response
    const contentBlockResult = aiResponse.content?.[0];
    if (!contentBlockResult || contentBlockResult.type !== "text") {
      return NextResponse.json(
        {
          success: false,
          error: { type: "api_error", message: "Unexpected response format from AI" },
        },
        { status: 502 }
      );
    }

    const extractedText: string = contentBlockResult.text.trim();

    // 12. Update attachment record with extracted text
    await supabase
      .from("attachments")
      .update({ extracted_text: extractedText })
      .eq("id", attachmentId);

    return NextResponse.json({ success: true, extracted_text: extractedText });
  } catch (error) {
    logger.error("Text extraction error", {
      feature: "ai-text-extraction",
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
