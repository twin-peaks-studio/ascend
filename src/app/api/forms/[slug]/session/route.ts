/**
 * GET /api/forms/[slug]/session
 *
 * Validates the tester's session cookie and returns the form's metadata + fields.
 * Used on page load to determine whether to show the password gate or the form.
 * Also verifies password_version matches (invalidates sessions after password change).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFormSession } from "@/lib/forms/session";
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

  // 2. Fetch the form from DB
  const supabase = createServiceClient();
  const { data: form, error } = await supabase
    .from("feedback_forms")
    .select("id, title, slug, password_version, fields")
    .eq("slug", slug)
    .single();

  if (error || !form) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Form not found" } },
      { status: 404 }
    );
  }

  // 3. Verify password_version — if developer changed password, invalidate old sessions
  if (session.passwordVersion !== form.password_version) {
    logger.info("Feedback form session invalidated (password changed)", {
      slug,
      formId: form.id,
      sessionVersion: session.passwordVersion,
      currentVersion: form.password_version,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          type: "session_invalidated",
          message: "The form password has been changed. Please re-authenticate.",
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      fields: form.fields,
    },
  });
}
