"use client";

/**
 * /forms/[slug]/tracker
 *
 * Tester-facing issue tracker. Shows all submitted feedback with live status.
 * Session cookie covers this page (same /forms/[slug] path scope).
 * If session is invalid, redirects to the form page for re-authentication.
 */

import { use, useEffect, useState } from "react";
import { useFormTracker } from "@/hooks/use-form-tracker";
import { TrackerView } from "@/components/forms/public/tracker-view";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TrackerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tasks, isLoading, unauthenticated } = useFormTracker(slug);
  const [formTitle, setFormTitle] = useState<string | null>(null);

  // Fetch form title for the header
  useEffect(() => {
    fetch(`/api/forms/${slug}/session`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setFormTitle(d.form.title);
      })
      .catch(() => null);
  }, [slug]);

  // If session is invalid, bounce to form page for re-auth
  if (unauthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Your session has expired. Please re-authenticate.
          </p>
          <Button asChild>
            <Link href={`/forms/${slug}`}>Back to Form</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`/forms/${slug}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Submit feedback
            </Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold">
          {formTitle ? `${formTitle} — Issues` : "Issue Tracker"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Live status of all submitted feedback. Updates every 30 seconds.
        </p>
      </div>

      {/* Tracker content */}
      <TrackerView tasks={tasks} isLoading={isLoading} />
    </div>
  );
}
