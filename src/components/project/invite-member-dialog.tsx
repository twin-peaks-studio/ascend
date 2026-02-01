"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, UserPlus, X, Crown, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useProjectMembers,
  useProjectMemberMutations,
  type ProjectMemberWithProfile,
} from "@/hooks/use-project-members";
import { useAuth } from "@/hooks/use-auth";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectCreatorId: string;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  projectId,
  projectCreatorId,
}: InviteMemberDialogProps) {
  const { user } = useAuth();
  const { members, loading: membersLoading, refetch } = useProjectMembers(projectId);
  const { inviteByEmail, removeMember, loading } = useProjectMemberMutations();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    const result = await inviteByEmail(projectId, email);

    if (result.success) {
      setEmail("");
      refetch();
    } else {
      setError(result.error || "Failed to invite user");
    }
  };

  const handleRemoveMember = async (member: ProjectMemberWithProfile) => {
    const result = await removeMember(projectId, member.id);
    if (result.success) {
      refetch();
    } else {
      setError(result.error || "Failed to remove member");
    }
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  const isOwner = user?.id === projectCreatorId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Project Members
          </DialogTitle>
          <DialogDescription>
            Invite team members to collaborate on this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current members */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Members</Label>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {membersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No members yet
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(
                            member.profile?.display_name,
                            member.profile?.email
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {member.profile?.display_name || member.profile?.email}
                          {member.user_id === user?.id && (
                            <span className="text-muted-foreground ml-1">(You)</span>
                          )}
                        </span>
                        {member.profile?.display_name && (
                          <span className="text-xs text-muted-foreground">
                            {member.profile.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === "owner" ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Crown className="h-3 w-3" />
                          Owner
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          <User className="h-3 w-3" />
                          Member
                        </span>
                      )}
                      {isOwner &&
                        member.user_id !== projectCreatorId &&
                        member.user_id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveMember(member)}
                            disabled={loading}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invite form - only for owners */}
          {isOwner && (
            <form onSubmit={handleInvite} className="space-y-3">
              <Label htmlFor="invite-email" className="text-sm font-medium">
                Invite by Email
              </Label>

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !email.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Invite"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The user must already have an account to be invited.
              </p>
            </form>
          )}

          {!isOwner && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Only project owners can invite new members.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
