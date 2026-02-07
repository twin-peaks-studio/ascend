"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  emailChangeSchema,
  passwordChangeSchema,
  accountDeletionSchema,
} from "@/lib/validation/settings";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function AccountSection() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [emailChanging, setEmailChanging] = useState(false);
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Account deletion state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleEmailChange = async () => {
    if (!user) return;

    try {
      const validated = emailChangeSchema.parse({ newEmail });
      setEmailChanging(true);

      const { error } = await supabase.auth.updateUser({
        email: validated.newEmail,
      });

      if (error) throw error;

      setEmailVerificationPending(true);
      toast.success(
        "Verification email sent! Please check your inbox to confirm your new email address."
      );
      setNewEmail("");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setEmailChanging(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user?.email) return;

    try {
      const validated = passwordChangeSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordChanging(true);

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: validated.currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (updateError) throw updateError;

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleAccountDeletion = async () => {
    try {
      accountDeletionSchema.parse({ confirmation: deleteConfirmation });
      setDeleting(true);

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully");
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Change Email</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">Current Email</Label>
            <Input id="current-email" value={user?.email || ""} disabled />
          </div>

          {emailVerificationPending && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Verification pending
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                We've sent a verification email. Please check your inbox and click the
                confirmation link to complete the email change.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-email">New Email</Label>
            <div className="flex gap-2">
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
              />
              <Button
                onClick={handleEmailChange}
                disabled={emailChanging || !newEmail}
              >
                {emailChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll receive a verification email at your new address.
            </p>
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={
              passwordChanging ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {passwordChanging ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Update Password
          </Button>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="rounded-lg border border-red-200 dark:border-red-900 p-6">
        <h3 className="text-lg font-semibold mb-2 text-red-900 dark:text-red-100">
          Delete Account
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be
          undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Account
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>This will permanently delete your account and all associated data:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Your profile and avatar</li>
                <li>All projects you own</li>
                <li>All tasks you created</li>
                <li>All notes and attachments</li>
                <li>Time tracking records</li>
              </ul>
              <p className="font-semibold pt-2">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-semibold">delete my account</span> to
                confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="delete my account"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleAccountDeletion}
              disabled={deleteConfirmation !== "delete my account" || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
