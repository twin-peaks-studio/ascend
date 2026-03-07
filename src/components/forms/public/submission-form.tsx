"use client";

/**
 * SubmissionForm
 *
 * Dynamically renders form fields from the form's field definition JSON.
 * Supports: text, textarea, select, radio, checkbox, url, email.
 * On submit: POSTs to /api/forms/[slug]/submit and calls onSubmitted with
 * submissionId + taskId so the parent can transition to the follow-up chat.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/types";

interface SubmissionFormProps {
  slug: string;
  formTitle: string;
  fields: FormField[];
  onSubmitted: (submissionId: string, taskId: string) => void;
}

type FieldValue = string | string[];

export function SubmissionForm({ slug, formTitle, fields, onSubmitted }: SubmissionFormProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const initial: Record<string, FieldValue> = {};
    for (const f of fields) {
      initial[f.id] = f.type === "checkbox" ? [] : "";
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(fieldId: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toggleCheckbox(fieldId: string, option: string) {
    setValues((prev) => {
      const current = (prev[fieldId] as string[]) ?? [];
      return {
        ...prev,
        [fieldId]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  }

  function validate(): string | null {
    for (const field of fields) {
      if (!field.required) continue;
      const val = values[field.id];
      if (Array.isArray(val) && val.length === 0) return `"${field.label}" is required.`;
      if (typeof val === "string" && !val.trim()) return `"${field.label}" is required.`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContents: values }),
      });

      const data = await res.json();

      if (!data.success) {
        if (res.status === 429) {
          setError("Too many submissions. Please try again later.");
        } else if (res.status === 401) {
          setError("Your session has expired. Please refresh the page.");
        } else {
          setError(data.error?.message ?? "Submission failed. Please try again.");
        }
        return;
      }

      onSubmitted(data.submissionId, data.taskId);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{formTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Fill out the fields below and submit your feedback.
        </p>
      </div>

      <div className="space-y-5">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>

            {field.type === "text" && (
              <Input
                id={field.id}
                type="text"
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}

            {field.type === "email" && (
              <Input
                id={field.id}
                type="email"
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder ?? "you@example.com"}
                required={field.required}
              />
            )}

            {field.type === "url" && (
              <Input
                id={field.id}
                type="url"
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder ?? "https://"}
                required={field.required}
              />
            )}

            {field.type === "textarea" && (
              <textarea
                id={field.id}
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            )}

            {field.type === "select" && field.options && (
              <select
                id={field.id}
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select an option…</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === "radio" && field.options && (
              <div className="space-y-2">
                {field.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={() => setValue(field.id, opt)}
                      required={field.required}
                      className="accent-primary"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {field.type === "checkbox" && field.options && (
              <div className="space-y-2">
                {field.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(values[field.id] as string[]).includes(opt)}
                      onChange={() => toggleCheckbox(field.id, opt)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting…" : "Submit Feedback"}
      </Button>
    </form>
  );
}
