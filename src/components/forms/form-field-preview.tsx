"use client";

/**
 * FormFieldPreview
 *
 * Read-only preview of a proposed form field structure.
 * Rendered in the form builder modal during the "reviewing" state
 * so the developer can see what fields will be created.
 */

import { cn } from "@/lib/utils";
import type { FormField } from "@/types";

interface FormFieldPreviewProps {
  fields: FormField[];
  className?: string;
}

const FIELD_TYPE_LABELS: Record<FormField["type"], string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Single choice",
  checkbox: "Multiple choice",
  url: "URL",
  email: "Email",
};

export function FormFieldPreview({ fields, className }: FormFieldPreviewProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5"
        >
          {/* Field number */}
          <span className="mt-0.5 text-xs font-medium text-muted-foreground tabular-nums w-4 shrink-0">
            {index + 1}.
          </span>

          {/* Field details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{field.label}</span>
              {field.required && (
                <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">
                  required
                </span>
              )}
              <span className="text-[10px] text-muted-foreground border border-border/60 rounded px-1 py-0.5">
                {FIELD_TYPE_LABELS[field.type]}
              </span>
            </div>

            {/* Options for select/radio/checkbox */}
            {field.options && field.options.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {field.options.join(" · ")}
              </p>
            )}

            {/* Placeholder */}
            {field.placeholder && (
              <p className="text-xs text-muted-foreground/70 italic mt-0.5 truncate">
                &quot;{field.placeholder}&quot;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
