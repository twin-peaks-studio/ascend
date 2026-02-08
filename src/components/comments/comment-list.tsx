"use client";

import { MessageSquare, Loader2 } from "lucide-react";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { useCommentMutations, useTaskComments, useProjectComments } from "@/hooks/use-comments";
import { useRealtimeCommentsForTask, useRealtimeCommentsForProject } from "@/hooks/use-realtime-comments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CommentListProps {
  taskId?: string | null;
  projectId?: string | null;
}

export function CommentList({ taskId, projectId }: CommentListProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
          {comments && comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment Form */}
        <CommentForm
          taskId={taskId}
          projectId={projectId}
          onSubmit={handleCreateComment}
          isSubmitting={isCreating}
        />

        <Separator />

        {/* Comments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments && comments.length > 0 ? (
          <div className="space-y-4">
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
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Be the first to share your thoughts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
