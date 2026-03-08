/**
 * POST /api/forms/[slug]/submit
 *
 * Tester submits a completed feedback form.
 * Option A: Task is created immediately with raw_contents as description.
 * The follow-up AI chat updates the task title + description on completion.
 *
 * Flow:
 *   1. Validate session cookie
 *   2. Validate + sanitize raw_contents
 *   3. Insert feedback_submission (raw_contents only; followup pending)
 *   4. Create Ascend task via AscendAdapter (source_type: feedback_form)
 *   5. Link task back to submission
 *   6. Return submissionId + taskId for the follow-up chat
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withRateLimit, createRateLimitResponse } from "@/lib/rate-limit/middleware";
import { feedbackSubmissionSchema } from "@/lib/validation";
import { getFormSession } from "@/lib/forms/session";
import { ascendAdapter } from "@/lib/forms/adapter";
import { logger } from "@/lib/logger";
import { sanitizeStringPreserveChars } from "@/lib/security/sanitize";
import type { FormField } from "@/types";

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

  // 2. Rate limit by IP — 10 submissions per hour
  const rateLimitCheck = await withRateLimit(request, null, "formSubmission");
  if (!rateLimitCheck.allowed) {
    return createRateLimitResponse(rateLimitCheck);
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const validated = feedbackSubmissionSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          type: "validation_error",
          message: validated.error.issues[0]?.message ?? "Invalid submission",
        },
      },
      { status: 400 }
    );
  }

  const { rawContents } = validated.data;

  // 4. Fetch the form to get fields and projectId
  const supabase = createServiceClient();
  const { data: form, error: formError } = await supabase
    .from("feedback_forms")
    .select("id, title, project_id, password_version, fields")
    .eq("id", session.formId)
    .eq("slug", slug)
    .single();

  if (formError || !form) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Form not found" } },
      { status: 404 }
    );
  }

  // Check password_version hasn't changed since cookie was issued
  if (session.passwordVersion !== form.password_version) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "session_invalidated", message: "Session expired — please re-authenticate" },
      },
      { status: 401 }
    );
  }

  // 5. Sanitize raw_contents values
  const sanitizedContents: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(rawContents)) {
    if (Array.isArray(value)) {
      sanitizedContents[key] = value.map((v) => sanitizeStringPreserveChars(v));
    } else {
      sanitizedContents[key] = sanitizeStringPreserveChars(value);
    }
  }

  // 6. Insert submission record (task_id is set after task creation)
  const { data: submission, error: insertError } = await supabase
    .from("feedback_submissions")
    .insert({
      form_id: form.id,
      raw_contents: sanitizedContents,
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    logger.error("Failed to insert feedback_submission", { error: insertError, formId: form.id });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to save submission" } },
      { status: 500 }
    );
  }

  // 7. Format raw contents as task description using field labels from form definition
  const fields = (form.fields as unknown as FormField[]) ?? [];
  const description = formatSubmissionDescription(sanitizedContents, fields);

  // 8. Create Ascend task immediately (Option A — always capture, never lose data)
  let taskId: string;
  try {
    const result = await ascendAdapter.createTask({
      title: `[Feedback] ${form.title}`, // Placeholder — AI will improve this after follow-up
      description,
      projectId: form.project_id,
      status: "todo",
      priority: "medium",
      feedbackSubmissionId: submission.id,
    });
    taskId = result.taskId;
  } catch (err) {
    logger.error("Failed to create task from submission", { error: err, submissionId: submission.id });
    // Still return success — submission is saved. Task will be created by a retry or manual review.
    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      taskId: null,
      warning: "Submission saved but task creation failed. Our team will follow up.",
    });
  }

  // 9. Link task back to submission
  await supabase
    .from("feedback_submissions")
    .update({ task_id: taskId })
    .eq("id", submission.id);

  logger.info("Feedback submission created with task", {
    formId: form.id,
    submissionId: submission.id,
    taskId,
  });

  return NextResponse.json({
    success: true,
    submissionId: submission.id,
    taskId,
  });
}

/**
 * Format raw form field values into a readable task description.
 * Matches field IDs to labels from the form definition.
 */
function formatSubmissionDescription(
  contents: Record<string, string | string[]>,
  fields: FormField[]
): string {
  const fieldMap = new Map(fields.map((f) => [f.id, f.label]));
  const reportedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines: string[] = ["**Feedback Submission**", "", `**Reported:** ${reportedDate}`, ""];

  for (const [key, value] of Object.entries(contents)) {
    const label = fieldMap.get(key) ?? key;
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    if (displayValue.trim()) {
      lines.push(`**${label}:**`);
      lines.push(displayValue);
      lines.push("");
    }
  }

  return lines.join("\n");
}
