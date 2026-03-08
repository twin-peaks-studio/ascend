"use client";

/**
 * FeedbackFormSection
 *
 * Collapsible section on the project page that lists all feedback forms
 * for the project and allows developers to create new ones via the
 * AI form builder modal.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormBuilderModal } from "@/components/forms/form-builder-modal";
import { FeedbackFormListItem } from "@/components/forms/feedback-form-list-item";
import type { FeedbackFormWithCount } from "@/types";

interface FeedbackFormSectionProps {
  projectId: string;
  projectTitle?: string | null;
}

export function FeedbackFormSection({
  projectId,
  projectTitle,
}: FeedbackFormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [forms, setForms] = useState<FeedbackFormWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/forms`);
      const data = await res.json();
      if (data.success) {
        setForms(data.forms);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load forms when section is expanded for the first time
  useEffect(() => {
    if (isExpanded && forms.length === 0 && !isLoading) {
      fetchForms();
    }
  }, [isExpanded, forms.length, isLoading, fetchForms]);

  const handleFormCreated = useCallback(() => {
    // Refetch the list to include the newly created form
    fetchForms();
  }, [fetchForms]);

  return (
    <>
      <div className="border-t border-border/40 pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <ClipboardList className="h-4 w-4" />
            Feedback Forms
            {forms.length > 0 && (
              <span className="text-xs font-normal">({forms.length})</span>
            )}
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBuilder(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Form
          </Button>
        </div>

        {isExpanded && (
          <div>
            {isLoading ? (
              <div className="py-4 flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : forms.length > 0 ? (
              <div className="border rounded-lg divide-y overflow-hidden">
                {forms.map((form) => (
                  <FeedbackFormListItem key={form.id} form={form} projectId={projectId} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="mb-1 text-sm">No feedback forms yet</p>
                <p className="text-xs">
                  Create a form to collect structured feedback from testers
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowBuilder(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create your first form
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <FormBuilderModal
        open={showBuilder}
        onOpenChange={setShowBuilder}
        projectId={projectId}
        projectTitle={projectTitle}
        onFormCreated={handleFormCreated}
      />
    </>
  );
}
