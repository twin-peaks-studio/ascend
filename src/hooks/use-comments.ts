"use client";

/**
 * Comments Data Hooks
 *
 * Custom hooks for fetching and mutating comment data.
 * Uses React Query for request deduplication, caching, and automatic refetching.
 */

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { toast } from "sonner";
import type { CommentWithAuthor, CommentInsert, CommentUpdate } from "@/types";

// Query keys for cache management
export const commentKeys = {
  all: ["comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  taskComments: (taskId: string) => [...commentKeys.lists(), "task", taskId] as const,
  projectComments: (projectId: string) => [...commentKeys.lists(), "project", projectId] as const,
};

/**
 * Fetch comments for a task
 */
async function fetchTaskComments(taskId: string): Promise<CommentWithAuthor[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from("comments")
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .eq("task_id", taskId)
    .is("project_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Error fetching task comments", { taskId, error });
    throw new Error(error.message);
  }

  return data as CommentWithAuthor[];
}

/**
 * Fetch comments for a project
 */
async function fetchProjectComments(projectId: string): Promise<CommentWithAuthor[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from("comments")
    .select(`
      *,
      author:profiles!comments_author_id_fkey(*)
    `)
    .eq("project_id", projectId)
    .is("task_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Error fetching project comments", { projectId, error });
    throw new Error(error.message);
  }

  return data as CommentWithAuthor[];
}

/**
 * Hook to fetch comments for a task
 */
export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: taskId ? commentKeys.taskComments(taskId) : ["comments", "task", "null"],
    queryFn: () => (taskId ? fetchTaskComments(taskId) : Promise.resolve([])),
    enabled: !!taskId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch comments for a project
 */
export function useProjectComments(projectId: string | null) {
  return useQuery({
    queryKey: projectId ? commentKeys.projectComments(projectId) : ["comments", "project", "null"],
    queryFn: () => (projectId ? fetchProjectComments(projectId) : Promise.resolve([])),
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for comment mutations (create, update, delete)
 */
export function useCommentMutations() {
  const queryClient = useQueryClient();
  const supabase = getClient();

  // Create comment
  const createComment = useMutation({
    mutationFn: async (input: CommentInsert) => {
      const { data, error } = await supabase
        .from("comments")
        .insert(input)
        .select(`
          *,
          author:profiles!comments_author_id_fkey(*)
        `)
        .single();

      if (error) {
        logger.error("Error creating comment", { input, error });
        throw new Error(error.message);
      }

      return data as CommentWithAuthor;
    },
    onSuccess: (newComment) => {
      // Invalidate the appropriate cache
      if (newComment.task_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.taskComments(newComment.task_id),
        });
      } else if (newComment.project_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.projectComments(newComment.project_id),
        });
      }
      toast.success("Comment added");
    },
    onError: (error: Error) => {
      logger.error("Failed to create comment", { error });
      toast.error(`Failed to add comment: ${error.message}`);
    },
  });

  // Update comment
  const updateComment = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: CommentUpdate;
    }) => {
      const { data, error } = await supabase
        .from("comments")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          author:profiles!comments_author_id_fkey(*)
        `)
        .single();

      if (error) {
        logger.error("Error updating comment", { id, updates, error });
        throw new Error(error.message);
      }

      return data as CommentWithAuthor;
    },
    onSuccess: (updatedComment) => {
      // Invalidate the appropriate cache
      if (updatedComment.task_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.taskComments(updatedComment.task_id),
        });
      } else if (updatedComment.project_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.projectComments(updatedComment.project_id),
        });
      }
      toast.success("Comment updated");
    },
    onError: (error: Error) => {
      logger.error("Failed to update comment", { error });
      toast.error(`Failed to update comment: ${error.message}`);
    },
  });

  // Delete comment
  const deleteComment = useMutation({
    mutationFn: async ({
      id,
      taskId,
      projectId,
    }: {
      id: string;
      taskId?: string | null;
      projectId?: string | null;
    }) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);

      if (error) {
        logger.error("Error deleting comment", { id, error });
        throw new Error(error.message);
      }

      return { id, taskId, projectId };
    },
    onSuccess: ({ taskId, projectId }) => {
      // Invalidate the appropriate cache
      if (taskId) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.taskComments(taskId),
        });
      } else if (projectId) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.projectComments(projectId),
        });
      }
      toast.success("Comment deleted");
    },
    onError: (error: Error) => {
      logger.error("Failed to delete comment", { error });
      toast.error(`Failed to delete comment: ${error.message}`);
    },
  });

  return {
    createComment: createComment.mutateAsync,
    updateComment: updateComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
    isCreating: createComment.isPending,
    isUpdating: updateComment.isPending,
    isDeleting: deleteComment.isPending,
  };
}
