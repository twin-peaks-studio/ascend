/**
 * PATCH /api/projects/[id]/forms/[formId] — update a feedback form
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateFeedbackFormSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/forms/session";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formId: string }> }
): Promise<NextResponse> {
  const { id: projectId, formId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { type: "auth_error", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const validated = updateFeedbackFormSchema.safeParse(body);
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

  const { title, password, fields, aiBuilderHistory } = validated.data;

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {};
  if (title !== undefined) updatePayload.title = title;
  if (fields !== undefined) updatePayload.fields = fields;
  if (aiBuilderHistory !== undefined) updatePayload.ai_builder_history = aiBuilderHistory;

  // If password is being changed, hash it and bump password_version
  if (password) {
    updatePayload.password_hash = await hashPassword(password);

    // Fetch current version so we can increment
    const { data: current } = await supabase
      .from("feedback_forms")
      .select("password_version")
      .eq("id", formId)
      .eq("project_id", projectId)
      .single();

    updatePayload.password_version = (current?.password_version ?? 1) + 1;
  }

  const { data: form, error: updateError } = await supabase
    .from("feedback_forms")
    .update(updatePayload)
    .eq("id", formId)
    .eq("project_id", projectId)
    .select("id, title, slug, updated_at")
    .single();

  if (updateError || !form) {
    logger.error("Failed to update feedback form", { error: updateError, formId, projectId });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to update form" } },
      { status: 500 }
    );
  }

  logger.info("Feedback form updated", { formId, projectId });
  return NextResponse.json({
    success: true,
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      updatedAt: form.updated_at,
    },
  });
}
