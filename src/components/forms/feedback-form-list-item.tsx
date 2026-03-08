"use client";

/**
 * FeedbackFormListItem
 *
 * A row in the developer-facing feedback forms section of the project page.
 * Shows form title, submission count, slug (URL), copy-link, and change-password buttons.
 */

import { useState, useCallback } from "react";
import { ExternalLink, Copy, Check, FileText, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FeedbackFormWithCount } from "@/types";

interface FeedbackFormListItemProps {
  form: FeedbackFormWithCount;
  projectId: string;
}

export function FeedbackFormListItem({ form, projectId }: FeedbackFormListItemProps) {
  const [copied, setCopied] = useState(false);
  // View password state
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  // Change password state
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  function openViewDialog() {
    setPasswordVisible(false);
    setShowViewDialog(true);
  }

  function openChangeDialog() {
    setNewPassword("");
    setSaveError(null);
    setSaveSuccess(false);
    setShowNewPassword(false);
    setShowChangeDialog(true);
  }

  async function handleChangePassword() {
    if (!newPassword.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveError(data.error?.message ?? "Failed to update password.");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setShowChangeDialog(false), 1200);
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
            title="View password"
            onClick={openViewDialog}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Change password"
            onClick={openChangeDialog}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
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

      {/* View password dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Form password</DialogTitle>
            <DialogDescription>
              Share this password with testers so they can access the form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label>Password</Label>
            {form.passwordPlain ? (
              <div className="relative">
                <Input
                  readOnly
                  type={passwordVisible ? "text" : "password"}
                  value={form.passwordPlain}
                  className="pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Password not available — set a new one using the change password option.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change form password</DialogTitle>
            <DialogDescription>
              All active tester sessions will be invalidated immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChangePassword();
                }}
                placeholder="Enter new password"
                className="pr-9"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="text-sm text-green-600">Password updated successfully.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={!newPassword.trim() || saving}
            >
              {saving ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
