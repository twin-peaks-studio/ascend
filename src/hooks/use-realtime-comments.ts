import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { commentKeys } from "@/hooks/use-comments";
import type { Comment, CommentWithAuthor } from "@/types";

/**
 * Subscribe to real-time comment updates for a specific task
 *
 * This hook subscribes to Supabase Realtime and updates the React Query cache
 * when comments are created, updated, or deleted by other users.
 *
 * @param taskId - Task ID to subscribe to, or null to disable subscription
 */
export function useRealtimeCommentsForTask(taskId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!taskId) return;

    const supabase = getClient();

    // Subscribe to comment changes for this task
    const channel = supabase
      .channel(`task:${taskId}:comments`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const newComment = payload.new as Comment | null;
          const oldComment = payload.old as Comment | null;

          logger.debug("Real-time comment update received", {
            event: payload.eventType,
            commentId: newComment?.id || oldComment?.id,
            taskId,
          });

          // Update the comment list cache
          queryClient.setQueryData<CommentWithAuthor[]>(
            commentKeys.taskComments(taskId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  const newComment = payload.new as Comment;
                  // Check if comment already exists (from optimistic update)
                  const exists = oldData.some((c) => c.id === newComment.id);
                  if (exists) {
                    // Replace optimistic comment with server version
                    return oldData.map((c) =>
                      c.id === newComment.id ? { ...newComment, author: c.author } : c
                    );
                  }
                  // For new comments from other users, we need to refetch to get author data
                  queryClient.invalidateQueries({
                    queryKey: commentKeys.taskComments(taskId),
                  });
                  return oldData;
                }

                case "UPDATE": {
                  const updatedComment = payload.new as Comment;
                  return oldData.map((comment) =>
                    comment.id === updatedComment.id
                      ? { ...comment, ...updatedComment }
                      : comment
                  );
                }

                case "DELETE": {
                  const deletedCommentId = payload.old?.id;
                  return oldData.filter((comment) => comment.id !== deletedCommentId);
                }

                default:
                  return oldData;
              }
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Subscribed to real-time comment updates", { taskId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time comment updates", {
            taskId,
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      logger.debug("Unsubscribing from real-time comment updates", { taskId });
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);
}

/**
 * Subscribe to real-time comment updates for a specific project
 *
 * This hook subscribes to Supabase Realtime and updates the React Query cache
 * when comments are created, updated, or deleted by other users.
 *
 * @param projectId - Project ID to subscribe to, or null to disable subscription
 */
export function useRealtimeCommentsForProject(projectId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    // Subscribe to comment changes for this project
    const channel = supabase
      .channel(`project:${projectId}:comments`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newComment = payload.new as Comment | null;
          const oldComment = payload.old as Comment | null;

          logger.debug("Real-time comment update received", {
            event: payload.eventType,
            commentId: newComment?.id || oldComment?.id,
            projectId,
          });

          // Update the comment list cache
          queryClient.setQueryData<CommentWithAuthor[]>(
            commentKeys.projectComments(projectId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  const newComment = payload.new as Comment;
                  // Check if comment already exists (from optimistic update)
                  const exists = oldData.some((c) => c.id === newComment.id);
                  if (exists) {
                    // Replace optimistic comment with server version
                    return oldData.map((c) =>
                      c.id === newComment.id ? { ...newComment, author: c.author } : c
                    );
                  }
                  // For new comments from other users, we need to refetch to get author data
                  queryClient.invalidateQueries({
                    queryKey: commentKeys.projectComments(projectId),
                  });
                  return oldData;
                }

                case "UPDATE": {
                  const updatedComment = payload.new as Comment;
                  return oldData.map((comment) =>
                    comment.id === updatedComment.id
                      ? { ...comment, ...updatedComment }
                      : comment
                  );
                }

                case "DELETE": {
                  const deletedCommentId = payload.old?.id;
                  return oldData.filter((comment) => comment.id !== deletedCommentId);
                }

                default:
                  return oldData;
              }
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Subscribed to real-time comment updates", { projectId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time comment updates", {
            projectId,
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      logger.debug("Unsubscribing from real-time comment updates", { projectId });
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
