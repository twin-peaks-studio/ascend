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
import Link from "next/link";
import { ClipboardList, PlusCircle } from "lucide-react";
import { PasswordGate } from "@/components/forms/public/password-gate";
import { SubmissionForm } from "@/components/forms/public/submission-form";
import { FollowupChat } from "@/components/forms/public/followup-chat";
import { CompletionScreen } from "@/components/forms/public/completion-screen";
import { Button } from "@/components/ui/button";
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
  | "choice"
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
        setPageState("choice");
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

  // ─── Choice Screen ────────────────────────────────────────────────────────

  if (pageState === "choice") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{formMeta.title}</h1>
            <p className="text-sm text-muted-foreground">What would you like to do?</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              className="w-full h-12 text-base gap-2"
              onClick={() => setPageState("form")}
            >
              <PlusCircle className="h-5 w-5" />
              Submit a new report
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-12 text-base gap-2"
            >
              <Link href={`/forms/${slug}/tracker`}>
                <ClipboardList className="h-5 w-5" />
                View submitted reports
              </Link>
            </Button>
          </div>
        </div>
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
          <FollowupChat
            slug={slug}
            submissionId={submissionId}
            taskId={taskId}
            onSubmitAnother={() => setPageState("form")}
          />
        </div>
      </div>
    );
  }

  // ─── Follow-up skipped (no taskId) → go straight to completion ───────────

  if (pageState === "followup" && submissionId && !taskId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <CompletionScreen
          slug={slug}
          submissionId={submissionId}
          onSubmitAnother={() => setPageState("form")}
        />
      </div>
    );
  }

  return null;
}
