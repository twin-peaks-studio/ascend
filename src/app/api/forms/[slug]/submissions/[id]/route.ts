/**
 * PATCH /api/forms/[slug]/submissions/[id]
 *
 * Called by the follow-up chat when the AI signals completion ({type: "complete"}).
 * Updates the submission record with followup_transcript + final_contents,
 * and patches the linked Ascend task with the AI-generated title and
 * a description that preserves all original user input verbatim.
 *
 * Description structure:
 *   Section 1 — Original submission (raw_contents formatted with field labels)
 *                This is the user's source of truth and is NEVER overwritten.
 *   Section 2 — AI summary (AI's interpretation of the full submission)
 *                Always present; gives a quick human-readable overview.
 *   Section 3 — Additional context from follow-up Q&A (AI-gathered only)
 *                Only present if the follow-up chat surfaced genuinely new information.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getFormSession } from "@/lib/forms/session";
import { ascendAdapter } from "@/lib/forms/adapter";
import { logger } from "@/lib/logger";
import type { FormField } from "@/types";

const patchSchema = z.object({
  taskTitle: z.string().min(1).max(200),
  /** AI's overall interpretation/summary of the full submission */
  aiSummary: z.string().max(2000),
  /** Only genuinely NEW info from follow-up Q&A — not restating original fields */
  additionalContext: z.record(z.string(), z.string()),
  followupTranscript: z.array(
    z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
  ),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
): Promise<NextResponse> {
  const { slug, id: submissionId } = await params;

  // 1. Validate session cookie
  const session = getFormSession(request, slug);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { type: "unauthenticated", message: "No valid session" } },
      { status: 401 }
    );
  }

  // 2. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const validated = patchSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "validation_error", message: validated.error.issues[0]?.message ?? "Invalid request" },
      },
      { status: 400 }
    );
  }

  const { taskTitle, aiSummary, additionalContext, followupTranscript } = validated.data;

  // 3. Fetch submission (including raw_contents — the user's verbatim input)
  const supabase = createServiceClient();
  const { data: submission, error: fetchError } = await supabase
    .from("feedback_submissions")
    .select("id, form_id, task_id, followup_complete, submitted_at, raw_contents")
    .eq("id", submissionId)
    .eq("form_id", session.formId)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Submission not found" } },
      { status: 404 }
    );
  }

  if (submission.followup_complete) {
    // Already finalized — idempotent response
    return NextResponse.json({ success: true, alreadyComplete: true });
  }

  // 4. Fetch form fields so we can map field IDs → human-readable labels
  const { data: form } = await supabase
    .from("feedback_forms")
    .select("fields")
    .eq("id", submission.form_id)
    .single();
  const formFields = (form?.fields as unknown as FormField[]) ?? [];

  // 5. Build task description — three sections:
  //    a) Original submission (raw_contents verbatim) — user's source of truth, never changed
  //    b) AI summary — AI's interpretation of the full submission
  //    c) Additional context (additionalContext) — only NEW info gathered during follow-up
  const originalSection = formatOriginalSubmission(
    submission.raw_contents as Record<string, string | string[]>,
    formFields,
    submission.submitted_at
  );

  let description = originalSection;

  if (aiSummary.trim()) {
    description += `\n\n---\n\n**AI Summary:**\n${aiSummary.trim()}`;
  }

  const additionalContextEntries = Object.entries(additionalContext).filter(([, v]) => v.trim());
  if (additionalContextEntries.length > 0) {
    const contextSection = additionalContextEntries.map(([k, v]) => `**${k}:**\n${v}`).join("\n\n");
    description += `\n\n---\n\n**Additional context from follow-up:**\n\n${contextSection}`;
  }

  // 6. Update submission record
  const { error: updateSubError } = await supabase
    .from("feedback_submissions")
    .update({
      followup_transcript: followupTranscript,
      final_contents: { aiSummary, additionalContext },
      followup_complete: true,
    })
    .eq("id", submissionId);

  if (updateSubError) {
    logger.error("Failed to update feedback_submission", { error: updateSubError, submissionId });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to save follow-up" } },
      { status: 500 }
    );
  }

  // 7. Update linked Ascend task — title improved by AI, description preserves original + appends context
  if (submission.task_id) {
    try {
      await ascendAdapter.updateTask(submission.task_id, {
        title: taskTitle,
        description,
      });
    } catch (err) {
      // Log but don't fail — submission is already saved
      logger.error("Failed to update task after followup completion", {
        error: err,
        taskId: submission.task_id,
        submissionId,
      });
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * Format raw form field values as the primary "original submission" section.
 * Maps field IDs to human-readable labels. Never modifies the values.
 */
function formatOriginalSubmission(
  contents: Record<string, string | string[]>,
  fields: FormField[],
  submittedAt: string
): string {
  const fieldMap = new Map(fields.map((f) => [f.id, f.label]));
  const reportedDate = new Date(submittedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines: string[] = ["**Feedback Submission**", "", `**Reported:** ${reportedDate}`, ""];

  for (const [key, value] of Object.entries(contents)) {
    const label = fieldMap.get(key) ?? key;
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    if (String(displayValue).trim()) {
      lines.push(`**${label}:**`);
      lines.push(String(displayValue));
      lines.push("");
    }
  }

  return lines.join("\n");
}
