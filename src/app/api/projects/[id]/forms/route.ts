/**
 * GET  /api/projects/[id]/forms  — list feedback forms for a project
 * POST /api/projects/[id]/forms  — create a new feedback form
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFeedbackFormSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/forms/session";
import { generateUniqueSlug } from "@/lib/forms/slug";
import { logger } from "@/lib/logger";

// ─── GET — List forms for a project ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { type: "auth_error", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Fetch forms with submission counts
  const { data: forms, error } = await supabase
    .from("feedback_forms")
    .select("id, title, slug, created_at, updated_at, feedback_submissions(count)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to fetch feedback forms", { error, projectId });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to load forms" } },
      { status: 500 }
    );
  }

  // Flatten submission count
  const result = (forms ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    slug: f.slug,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    submissionCount: Array.isArray(f.feedback_submissions)
      ? (f.feedback_submissions[0] as { count: number } | undefined)?.count ?? 0
      : 0,
  }));

  return NextResponse.json({ success: true, forms: result });
}

// ─── POST — Create a new feedback form ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { type: "auth_error", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Validate request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const validated = createFeedbackFormSchema.safeParse({ ...body as object, projectId });
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

  // Hash password and generate slug
  const [passwordHash, slug] = await Promise.all([
    hashPassword(password),
    generateUniqueSlug(title),
  ]);

  // Insert into DB
  const { data: form, error: insertError } = await supabase
    .from("feedback_forms")
    .insert({
      project_id: projectId,
      title,
      slug,
      password_hash: passwordHash,
      password_version: 1,
      fields,
      ai_builder_history: aiBuilderHistory ?? null,
    })
    .select("id, title, slug, created_at")
    .single();

  if (insertError || !form) {
    logger.error("Failed to create feedback form", { error: insertError, projectId });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to create form" } },
      { status: 500 }
    );
  }

  logger.info("Feedback form created", { formId: form.id, slug, projectId });
  return NextResponse.json({
    success: true,
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      createdAt: form.created_at,
    },
  });
}
