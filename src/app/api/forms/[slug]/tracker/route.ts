/**
 * GET /api/forms/[slug]/tracker
 *
 * Returns all tasks linked to this feedback form for the tester tracker.
 * Polled every 30s by the tracker page via React Query.
 * Auth: form session cookie. Uses service role to bypass RLS.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFormSession } from "@/lib/forms/session";
import { createServiceClient } from "@/lib/supabase/service";
import { ascendAdapter } from "@/lib/forms/adapter";
import { logger } from "@/lib/logger";

export async function GET(
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

  // 2. Verify password_version hasn't changed
  const supabase = createServiceClient();
  const { data: form, error: formError } = await supabase
    .from("feedback_forms")
    .select("id, password_version")
    .eq("slug", slug)
    .single();

  if (formError || !form) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Form not found" } },
      { status: 404 }
    );
  }

  if (session.passwordVersion !== form.password_version) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "session_invalidated", message: "Session expired — please re-authenticate" },
      },
      { status: 401 }
    );
  }

  // 3. Fetch tasks via adapter
  try {
    const tasks = await ascendAdapter.listTasks(form.id);
    return NextResponse.json({ success: true, tasks });
  } catch (err) {
    logger.error("Failed to list tracker tasks", { error: err, formId: form.id });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Failed to load issues" } },
      { status: 500 }
    );
  }
}
