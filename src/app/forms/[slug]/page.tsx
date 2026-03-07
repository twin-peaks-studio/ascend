"use client";

/**
 * /forms/[slug]
 *
 * Tester-facing feedback form page. Handles the full flow:
 *   password gate → submission form → AI follow-up chat → completion
 *
 * On mount, calls GET /api/forms/[slug]/session to check for a valid cookie.
 * If no valid session: shows PasswordGate.
 * If valid session: shows the submission form.
 */

import { use, useEffect, useState } from "react";
import { PasswordGate } from "@/components/forms/public/password-gate";
import { SubmissionForm } from "@/components/forms/public/submission-form";
import { FollowupChat } from "@/components/forms/public/followup-chat";
import { CompletionScreen } from "@/components/forms/public/completion-screen";
import type { FormField } from "@/types";

interface FormMeta {
  id: string;
  title: string;
  slug: string;
  fields: FormField[];
}

type PageState =
  | "loading"
  | "needs-auth"
  | "form"
  | "followup"
  | "done"
  | "error";

export default function FormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [formMeta, setFormMeta] = useState<FormMeta | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function checkSession() {
    try {
      const res = await fetch(`/api/forms/${slug}/session`);
      const data = await res.json();

      if (data.success) {
        setFormMeta(data.form as FormMeta);
        setPageState("form");
      } else if (
        data.error?.type === "unauthenticated" ||
        data.error?.type === "session_invalidated"
      ) {
        setPageState("needs-auth");
      } else if (data.error?.type === "not_found") {
        setErrorMessage("This form does not exist or has been removed.");
        setPageState("error");
      } else {
        setPageState("needs-auth");
      }
    } catch {
      setErrorMessage("Unable to load form. Please check your connection.");
      setPageState("error");
    }
  }

  useEffect(() => {
    checkSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function handleAuthenticated() {
    checkSession();
  }

  function handleSubmitted(newSubmissionId: string, newTaskId: string) {
    setSubmissionId(newSubmissionId);
    setTaskId(newTaskId);
    setPageState("followup");
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (pageState === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // ─── Password Gate ────────────────────────────────────────────────────────

  if (pageState === "needs-auth") {
    return (
      <PasswordGate
        slug={slug}
        formTitle="Feedback Form"
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (!formMeta) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Submission Form ──────────────────────────────────────────────────────

  if (pageState === "form") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <SubmissionForm
            slug={slug}
            formTitle={formMeta.title}
            fields={formMeta.fields}
            onSubmitted={handleSubmitted}
          />
        </div>
      </div>
    );
  }

  // ─── Follow-up Chat ───────────────────────────────────────────────────────

  if (pageState === "followup" && submissionId && taskId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-xl border bg-card shadow-sm overflow-hidden">
          <FollowupChat slug={slug} submissionId={submissionId} taskId={taskId} />
        </div>
      </div>
    );
  }

  // ─── Follow-up skipped (no taskId) → go straight to completion ───────────

  if (pageState === "followup" && submissionId && !taskId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <CompletionScreen slug={slug} submissionId={submissionId} />
      </div>
    );
  }

  return null;
}
