/**
 * PATCH /api/forms/[slug]/submissions/[id]
 *
 * Called by the follow-up chat when the AI signals completion ({type: "complete"}).
 * Updates the submission record with followup_transcript + final_contents,
 * and patches the linked Ascend task with the AI-generated title and
 * formatted description.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getFormSession } from "@/lib/forms/session";
import { ascendAdapter } from "@/lib/forms/adapter";
import { logger } from "@/lib/logger";

const patchSchema = z.object({
  taskTitle: z.string().min(1).max(200),
  finalContents: z.record(z.string(), z.string()),
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

  const { taskTitle, finalContents, followupTranscript } = validated.data;

  // 3. Fetch submission — verify it belongs to this session's form
  const supabase = createServiceClient();
  const { data: submission, error: fetchError } = await supabase
    .from("feedback_submissions")
    .select("id, form_id, task_id, followup_complete, submitted_at")
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

  // 4. Build final task description from finalContents
  const reportedDate = new Date(submission.submitted_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const description = Object.entries(finalContents)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `**${k}:** ${v}`)
    .join("\n");

  // 5. Update submission record
  const { error: updateSubError } = await supabase
    .from("feedback_submissions")
    .update({
      followup_transcript: followupTranscript,
      final_contents: finalContents,
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

  // 6. Update linked Ascend task with AI-generated title + final description
  if (submission.task_id) {
    try {
      await ascendAdapter.updateTask(submission.task_id, {
        title: taskTitle,
        description: `**Feedback Submission**\n\n**Reported:** ${reportedDate}\n\n${description}`,
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
