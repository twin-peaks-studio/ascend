/**
 * POST /api/forms/[slug]/verify-password
 *
 * Password gate for tester access to a feedback form.
 * On success, issues a signed HttpOnly session cookie scoped to /forms/[slug].
 * Rate-limited per IP: 5 attempts per 15-minute window.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withRateLimit, createRateLimitResponse } from "@/lib/rate-limit/middleware";
import { formPasswordSchema } from "@/lib/validation";
import { verifyPassword, setFormSessionCookie } from "@/lib/forms/session";
import type { FormSessionPayload } from "@/lib/forms/session";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  // 1. Rate limit — IP-based (testers are not authenticated Supabase users)
  const rateLimitCheck = await withRateLimit(request, null, "formPasswordGate");
  if (!rateLimitCheck.allowed) {
    return createRateLimitResponse(rateLimitCheck);
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const validated = formPasswordSchema.safeParse(body);
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

  const { password } = validated.data;

  // 3. Look up the form by slug
  const supabase = createServiceClient();
  const { data: form, error: fetchError } = await supabase
    .from("feedback_forms")
    .select("id, slug, password_hash, password_version")
    .eq("slug", slug)
    .single();

  if (fetchError || !form) {
    // Return 404 — don't leak whether the slug exists
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Form not found" } },
      { status: 404 }
    );
  }

  // 4. Verify password
  const passwordOk = await verifyPassword(password, form.password_hash);
  if (!passwordOk) {
    logger.warn("Feedback form password attempt failed", { slug, formId: form.id });
    return NextResponse.json(
      { success: false, error: { type: "invalid_password", message: "Incorrect password" } },
      { status: 401 }
    );
  }

  // 5. Issue session cookie
  const payload: FormSessionPayload = {
    formId: form.id,
    slug: form.slug,
    passwordVersion: form.password_version,
    issuedAt: Date.now(),
  };

  const response = NextResponse.json({ success: true });
  setFormSessionCookie(response, slug, payload);

  logger.info("Feedback form session issued", { slug, formId: form.id });
  return response;
}
