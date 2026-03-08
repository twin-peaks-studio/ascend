"use client";

/**
 * SubmissionForm
 *
 * Dynamically renders form fields from the form's field definition JSON.
 * Supports: text, textarea, select, radio, checkbox, url, email.
 * Always includes an optional file attachment section at the bottom.
 *
 * On submit:
 *   1. POSTs field values to /api/forms/[slug]/submit → gets submissionId + taskId
 *   2. Uploads any selected files to /api/forms/[slug]/submissions/[id]/upload
 *   3. Calls onSubmitted so the parent transitions to the follow-up chat
 */

import { useState, useRef, useCallback } from "react";
import { Paperclip, X, FileText, Image, Video, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormField } from "@/types";

interface SubmissionFormProps {
  slug: string;
  formTitle: string;
  fields: FormField[];
  onSubmitted: (submissionId: string, taskId: string) => void;
}

type FieldValue = string | string[];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (mimeType.includes("zip")) return <Archive className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

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

  // File attachment state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const toAdd: File[] = [];
    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 10MB file size limit.`);
        continue;
      }
      toAdd.push(file);
    }
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...toAdd.filter((f) => !existingNames.has(f.name))];
    });
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setUploadStatus(null);

    try {
      // 1. Submit form field values
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

      const { submissionId, taskId } = data;

      // 2. Upload files (non-fatal — proceed even if some uploads fail)
      if (selectedFiles.length > 0) {
        setUploadStatus(
          `Uploading ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}…`
        );
        await Promise.allSettled(
          selectedFiles.map(async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            await fetch(`/api/forms/${slug}/submissions/${submissionId}/upload`, {
              method: "POST",
              body: fd,
            });
          })
        );
      }

      onSubmitted(submissionId, taskId);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  }

  const submitLabel = loading
    ? (uploadStatus ?? "Submitting…")
    : "Submit Feedback";

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
                className="text-base"
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
                className="text-base"
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
                className="text-base"
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            )}

            {field.type === "select" && field.options && (
              <select
                id={field.id}
                value={values[field.id] as string}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <div className="space-y-1">
                {field.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={() => setValue(field.id, opt)}
                      required={field.required}
                      className="accent-primary h-4 w-4 flex-shrink-0"
                    />
                    <span className="text-base">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {field.type === "checkbox" && field.options && (
              <div className="space-y-1">
                {field.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(values[field.id] as string[]).includes(opt)}
                      onChange={() => toggleCheckbox(field.id, opt)}
                      className="accent-primary h-4 w-4 flex-shrink-0"
                    />
                    <span className="text-base">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── File attachments ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>
          Attachments{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-input hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop files here or{" "}
            <span className="text-primary font-medium">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">Max 10MB per file</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <ul className="space-y-1.5">
            {selectedFiles.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2"
              >
                <FileIcon mimeType={file.type} />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full h-11">
        {submitLabel}
      </Button>
    </form>
  );
}
