"use client";

/**
 * CompletionScreen
 *
 * Shown after follow-up chat completes (or is skipped).
 * Displays a confirmation message with two next-step actions:
 *   - "View all submissions" → /forms/[slug]/tracker
 *   - "Submit another report" → /forms/[slug] (fresh form)
 */

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CompletionScreenProps {
  slug: string;
  submissionId: string;
  onSubmitAnother: () => void;
}

export function CompletionScreen({ slug, submissionId: _submissionId, onSubmitAnother }: CompletionScreenProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-10 px-6">
      <div className="rounded-full bg-green-500/10 p-4">
        <CheckCircle className="h-8 w-8 text-green-500" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold">Report submitted — thank you!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your feedback has been logged and the team has been notified.
          What would you like to do next?
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button asChild variant="default" className="w-full h-11">
          <Link href={`/forms/${slug}/tracker`}>
            View all submissions
          </Link>
        </Button>
        <Button variant="outline" className="w-full h-11" onClick={onSubmitAnother}>
          Submit another report
        </Button>
      </div>
    </div>
  );
}
