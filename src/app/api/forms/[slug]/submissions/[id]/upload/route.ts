/**
 * POST /api/forms/[slug]/submissions/[id]/upload
 *
 * Server-side file upload for tester feedback submissions.
 * Testers are not Supabase users — uploads go through this route
 * using the service role client.
 *
 * Auth: form session cookie
 * Input: multipart/form-data with a single `file` field
 * Storage path: task/{taskId}/{timestamp}-{safeFilename}
 * DB: inserts into the attachments table with entity_type="task"
 *     so files appear automatically in the Ascend task detail view.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFormSession } from "@/lib/forms/session";
import { createServiceClient } from "@/lib/supabase/service";
import { withRateLimit, createRateLimitResponse } from "@/lib/rate-limit/middleware";
import {
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from "@/lib/validation/file-types";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
): Promise<NextResponse> {
  const { slug, id: submissionId } = await params;

  // Rate limit — reuse formSubmission bucket (IP-based)
  const rateLimitCheck = await withRateLimit(request, null, "formSubmission");
  if (!rateLimitCheck.allowed) {
    return createRateLimitResponse(rateLimitCheck);
  }

  // Validate session cookie
  const session = getFormSession(request, slug);
  if (!session) {
    return NextResponse.json(
      { success: false, error: { type: "unauthenticated", message: "No valid session" } },
      { status: 401 }
    );
  }

  const supabase = createServiceClient();

  // Verify password_version hasn't changed
  const { data: form } = await supabase
    .from("feedback_forms")
    .select("id, password_version")
    .eq("slug", slug)
    .single();

  if (!form || session.passwordVersion !== form.password_version) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "session_invalidated", message: "Session expired — please re-authenticate" },
      },
      { status: 401 }
    );
  }

  // Look up the submission to get task_id
  const { data: submission } = await supabase
    .from("feedback_submissions")
    .select("id, task_id")
    .eq("id", submissionId)
    .eq("form_id", form.id)
    .single();

  if (!submission || !submission.task_id) {
    return NextResponse.json(
      { success: false, error: { type: "not_found", message: "Submission not found" } },
      { status: 404 }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "Invalid form data" } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "No file provided" } },
      { status: 400 }
    );
  }

  const filename = file instanceof File ? file.name : "upload";
  const mimeType = file.type;
  const fileSize = file.size;

  // Validate size
  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: { type: "validation_error", message: `File exceeds the 10MB limit` },
      },
      { status: 400 }
    );
  }

  // Validate type — MIME allowlist + extension allowlist + MIME blocklist
  const extension = getExtension(filename);
  const mimeAllowed = ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number]);
  const extAllowed = ALLOWED_EXTENSIONS.includes(extension as typeof ALLOWED_EXTENSIONS[number]);
  const mimeBlocked = BLOCKED_MIME_TYPES.includes(mimeType as typeof BLOCKED_MIME_TYPES[number]);

  if (!mimeAllowed || !extAllowed || mimeBlocked) {
    return NextResponse.json(
      { success: false, error: { type: "validation_error", message: "File type not allowed" } },
      { status: 400 }
    );
  }

  // Build a collision-safe storage path
  const safe = safeFilename(filename);
  const storagePath = `task/${submission.task_id}/${Date.now()}-${safe}`;

  // Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer();
  const { error: storageError } = await supabase.storage
    .from("attachments")
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (storageError) {
    logger.error("Feedback form upload: storage failed", {
      error: storageError,
      submissionId,
      filename,
    });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Upload failed" } },
      { status: 500 }
    );
  }

  // Insert DB record
  const { data: attachment, error: dbError } = await supabase
    .from("attachments")
    .insert({
      entity_type: "task",
      entity_id: submission.task_id,
      filename,
      file_path: storagePath,
      file_size: fileSize,
      mime_type: mimeType,
    })
    .select("id, filename, file_size, mime_type, file_path")
    .single();

  if (dbError || !attachment) {
    // Clean up the orphaned storage file
    await supabase.storage.from("attachments").remove([storagePath]);
    logger.error("Feedback form upload: DB insert failed", {
      error: dbError,
      submissionId,
      filename,
    });
    return NextResponse.json(
      { success: false, error: { type: "server_error", message: "Upload failed" } },
      { status: 500 }
    );
  }

  logger.info("Feedback form file uploaded", {
    submissionId,
    taskId: submission.task_id,
    filename,
    fileSize,
  });

  return NextResponse.json({ success: true, attachment });
}
