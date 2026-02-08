"use client";

import { useState } from "react";
import { MessageSquare, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { useCommentMutations, useTaskComments, useProjectComments } from "@/hooks/use-comments";
import { useRealtimeCommentsForTask, useRealtimeCommentsForProject } from "@/hooks/use-realtime-comments";

interface CommentListProps {
  taskId?: string | null;
  projectId?: string | null;
  collapsible?: boolean;
}

export function CommentList({
  taskId,
  projectId,
  collapsible = true
}: CommentListProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  // Fetch comments based on whether this is for a task or project
  const { data: taskCommentsData, isLoading: isLoadingTaskComments } = useTaskComments(taskId || null);
  const { data: projectCommentsData, isLoading: isLoadingProjectComments } = useProjectComments(projectId || null);

  // Subscribe to real-time updates
  useRealtimeCommentsForTask(taskId || null);
  useRealtimeCommentsForProject(projectId || null);

  // Comment mutations
  const { createComment, updateComment, deleteComment, isCreating, isUpdating, isDeleting } = useCommentMutations();

  // Determine which data to use
  const comments = taskId ? taskCommentsData : projectCommentsData;
  const isLoading = taskId ? isLoadingTaskComments : isLoadingProjectComments;

  // Auto-expand when comments exist (render-time check)
  const [hasCheckedComments, setHasCheckedComments] = useState(false);
  if (comments && comments.length > 0 && !hasCheckedComments) {
    setHasCheckedComments(true);
    setIsExpanded(true);
  }
  // Reset the check when all comments are deleted
  if (comments && comments.length === 0 && hasCheckedComments) {
    setHasCheckedComments(false);
  }

  const handleCreateComment = async (input: Parameters<typeof createComment>[0]) => {
    await createComment(input);
  };

  const handleUpdateComment = async (id: string, updates: Parameters<typeof updateComment>[0]["updates"]) => {
    await updateComment({ id, updates });
  };

  const handleDeleteComment = async (id: string) => {
    await deleteComment({
      id,
      taskId: taskId || null,
      projectId: projectId || null,
    });
  };

  return (
    <div>
      {/* Header - Collapsible or Static */}
      {collapsible ? (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <MessageSquare className="h-4 w-4" />
          <span>
            Comments{" "}
            {comments && comments.length > 0 && `(${comments.length})`}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <MessageSquare className="h-4 w-4" />
          <span>
            Comments{" "}
            {comments && comments.length > 0 && `(${comments.length})`}
          </span>
        </div>
      )}

      {/* Content - Always shown if not collapsible */}
      {(isExpanded || !collapsible) && (
        <div className="mt-4 space-y-4">
          {/* Comments List - Scrollable only if collapsible */}
          <div className={collapsible ? "max-h-[250px] overflow-y-scroll overscroll-contain pr-2" : ""}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-4 pb-2">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onUpdate={handleUpdateComment}
                    onDelete={handleDeleteComment}
                    isUpdating={isUpdating}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No comments yet</p>
              </div>
            )}
          </div>

          {/* Comment Form - Fixed at bottom, outside scrollable area */}
          <CommentForm
            taskId={taskId}
            projectId={projectId}
            onSubmit={handleCreateComment}
            isSubmitting={isCreating}
          />
        </div>
      )}
    </div>
  );
}
