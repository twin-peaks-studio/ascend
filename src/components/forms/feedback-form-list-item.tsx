"use client";

/**
 * FeedbackFormListItem
 *
 * A row in the developer-facing feedback forms section of the project page.
 * Shows form title, submission count, slug (URL), and a copy-link button.
 */

import { useState, useCallback } from "react";
import { ExternalLink, Copy, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedbackFormWithCount } from "@/types";

interface FeedbackFormListItemProps {
  form: FeedbackFormWithCount;
}

export function FeedbackFormListItem({ form }: FeedbackFormListItemProps) {
  const [copied, setCopied] = useState(false);

  const formUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/forms/${form.slug}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail — clipboard API unavailable
    }
  }, [formUrl]);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 rounded-md group transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{form.title}</span>
          {form.submissionCount > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {form.submissionCount} submission{form.submissionCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          /forms/{form.slug}
        </p>
      </div>

      {/* Actions — visible on hover */}
      <div
        className={cn(
          "flex items-center gap-1 transition-opacity",
          "opacity-0 group-hover:opacity-100"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Copy form URL"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Open form"
          asChild
        >
          <a href={formUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
