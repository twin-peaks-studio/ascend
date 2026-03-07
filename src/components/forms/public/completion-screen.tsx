"use client";

/**
 * CompletionScreen
 *
 * Shown after follow-up chat completes (or is skipped).
 * Displays a confirmation message and two action buttons:
 *   - "View all issues" → /forms/[slug]/tracker
 *   - "View this issue" → /forms/[slug]/tracker#[submissionId]
 */

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CompletionScreenProps {
  slug: string;
  submissionId: string;
}

export function CompletionScreen({ slug, submissionId }: CompletionScreenProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-5 py-8 px-4">
      <div className="rounded-full bg-green-500/10 p-4">
        <CheckCircle className="h-8 w-8 text-green-500" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Thank you! Your report has been submitted.</h2>
        <p className="text-sm text-muted-foreground">
          The team has been notified and will review your feedback shortly.
          You can track the status of your report below.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button asChild variant="default" className="flex-1">
          <Link href={`/forms/${slug}/tracker#${submissionId}`}>
            View this issue
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/forms/${slug}/tracker`}>
            View all issues
          </Link>
        </Button>
      </div>
    </div>
  );
}
