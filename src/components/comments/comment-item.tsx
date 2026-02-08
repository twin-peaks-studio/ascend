"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Edit2, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { CommentWithAuthor, CommentUpdate } from "@/types";

interface CommentItemProps {
  comment: CommentWithAuthor;
  onUpdate: (id: string, updates: CommentUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function CommentItem({
  comment,
  onUpdate,
  onDelete,
  isUpdating = false,
  isDeleting = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAuthor = user?.id === comment.author_id;
  const authorInitials = comment.author.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || comment.author.email?.[0]?.toUpperCase() || "?";

  const handleSaveEdit = async () => {
    if (!editedContent.trim() || editedContent === comment.content) {
      setIsEditing(false);
      setEditedContent(comment.content);
      return;
    }

    await onUpdate(comment.id, { content: editedContent.trim() });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(comment.content);
  };

  const handleConfirmDelete = async () => {
    await onDelete(comment.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.author.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 relative">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {comment.author.display_name || comment.author.email}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
            })}
            {comment.updated_at !== comment.created_at && " (edited)"}
          </span>
        </div>

        {isAuthor && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-0 right-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Comment options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                disabled={isUpdating || isDeleting}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                disabled={isUpdating || isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
              disabled={isUpdating}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editedContent.trim() || isUpdating}
              >
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}
      </div>

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete Comment"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
