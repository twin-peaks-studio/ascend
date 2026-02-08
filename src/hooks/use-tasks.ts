"use client";

/**
 * Task Data Hooks
 *
 * Custom hooks for fetching and mutating task data.
 * Uses React Query for request deduplication, caching, and automatic refetching.
 * Tasks are filtered by user access through their projects.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { singleTaskKeys } from "@/hooks/use-task";
import type { Task, TaskWithProject, TaskStatus } from "@/types";
import type { TaskInsert, TaskUpdate } from "@/types/database";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (userId: string) => [...taskKeys.lists(), userId] as const,
};

/**
 * Fetch all tasks for a user
 */
async function fetchTasksForUser(userId: string): Promise<TaskWithProject[]> {
  const supabase = getClient();

  // First get project IDs where user is creator or member
  const memberResult = await withTimeout(
    supabase.from("project_members").select("project_id").eq("user_id", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching member projects timed out"
  );

  if (memberResult.error) {
    logger.error("Error fetching member projects", {
      userId,
      error: memberResult.error
    });
  }

  const memberProjectIds = memberResult.data?.map((m: { project_id: string }) => m.project_id) || [];

  // Get projects created by user
  const ownedResult = await withTimeout(
    supabase.from("projects").select("id").eq("created_by", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching owned projects timed out"
  );

  if (ownedResult.error) {
    logger.error("Error fetching owned projects", {
      userId,
      error: ownedResult.error
    });
  }

  const ownedProjectIds = ownedResult.data?.map((p: { id: string }) => p.id) || [];

  // Combine all project IDs user has access to
  const accessibleProjectIds = [
    ...new Set([...memberProjectIds, ...ownedProjectIds]),
  ];

  // Build the query
  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects(*),
      assignee:profiles(*)
    `
    )
    .eq("is_archived", false);

  if (accessibleProjectIds.length === 0) {
    // No accessible projects - just fetch tasks created by user
    query = query.eq("created_by", userId);
  } else {
    // Fetch tasks from accessible projects OR created by user
    query = query.or(
      `project_id.in.(${accessibleProjectIds.join(",")}),created_by.eq.${userId}`
    );
  }

  const tasksResult = await withTimeout(
    query.order("position", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching tasks timed out"
  );

  if (tasksResult.error) {
    logger.error("Error fetching tasks", {
      userId,
      error: tasksResult.error,
      accessibleProjectCount: accessibleProjectIds.length
    });
    throw tasksResult.error;
  }

  return (tasksResult.data as TaskWithProject[]) || [];
}

/**
 * Hook to fetch all tasks (non-archived)
 * Uses React Query for deduplication - multiple components calling this = 1 request
 */
export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: taskKeys.list(user?.id ?? ""),
    queryFn: () => fetchTasksForUser(user!.id),
    enabled: !!user, // Only run when user is logged in
    staleTime: 30 * 1000, // Consider fresh for 30s
    refetchOnWindowFocus: true, // Refetch when returning from background
  });

  return {
    tasks,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    // For optimistic updates - set tasks directly in cache
    setTasks: (updater: TaskWithProject[] | ((prev: TaskWithProject[]) => TaskWithProject[])) => {
      queryClient.setQueryData(
        taskKeys.list(user?.id ?? ""),
        typeof updater === "function" ? updater(tasks) : updater
      );
    },
  };
}

/**
 * Hook to get tasks grouped by status (for Kanban board)
 */
export function useTasksByStatus() {
  const { tasks, loading, error, refetch, setTasks } = useTasks();

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return {
    tasks,
    tasksByStatus,
    loading,
    error,
    refetch,
    setTasks,
  };
}

/**
 * Hook for task mutations (create, update, delete)
 * Automatically invalidates relevant queries after mutations
 */
export function useTaskMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in to create a task");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        // Validate input
        const validated = createTaskSchema.parse(input);

        // Get the highest position for the status column
        const positionResult = await withTimeout(
          supabase
            .from("tasks")
            .select("position")
            .eq("status", validated.status)
            .order("position", { ascending: false })
            .limit(1)
            .then(res => res),
          TIMEOUTS.DATA_QUERY
        );

        const maxPosition = positionResult.data?.[0]?.position ?? -1;

        const insertData: TaskInsert = {
          project_id: validated.project_id ?? null,
          title: validated.title,
          description: validated.description ?? null,
          status: validated.status,
          priority: validated.priority,
          position: maxPosition + 1,
          due_date: validated.due_date ?? null,
          assignee_id: validated.assignee_id ?? null,
          created_by: user.id,
        };

        const insertResult = await withTimeout(
          supabase.from("tasks").insert(insertData).select().single().then(res => res),
          TIMEOUTS.MUTATION
        );

        if (insertResult.error) throw insertResult.error;

        // Invalidate tasks list to refetch
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

        toast.success("Task created successfully");
        return insertResult.data as Task;
      } catch (err: unknown) {
        const supabaseError = err as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        logger.error("Error creating task", {
          userId: user.id,
          projectId: input.project_id,
          error: {
            message: supabaseError.message,
            code: supabaseError.code,
            details: supabaseError.details,
            hint: supabaseError.hint,
          },
        });
        toast.error(supabaseError.message || "Failed to create task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        // Validate input
        const validated = updateTaskSchema.parse(input);

        const updateData: TaskUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const updateResult = await withTimeout(
          supabase.from("tasks").update(updateData).eq("id", taskId).select().single().then(res => res),
          TIMEOUTS.MUTATION
        );

        if (updateResult.error) throw updateResult.error;

        // Invalidate tasks list and single task cache
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        queryClient.invalidateQueries({ queryKey: singleTaskKeys.detail(taskId) });

        return updateResult.data as Task;
      } catch (err: unknown) {
        const supabaseError = err as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        logger.error("Error updating task", {
          taskId,
          error: {
            message: supabaseError.message,
            code: supabaseError.code,
            details: supabaseError.details,
            hint: supabaseError.hint,
          },
        });
        toast.error(supabaseError.message || "Failed to update task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  /**
   * Update task position and status (for drag-and-drop)
   * Uses optimistic update pattern
   */
  const updateTaskPosition = useCallback(
    async (taskId: string, newStatus: TaskStatus, newPosition: number): Promise<boolean> => {
      try {
        const supabase = getClient();

        const updateResult = await withTimeout(
          supabase
            .from("tasks")
            .update({
              status: newStatus,
              position: newPosition,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId)
            .then(res => res),
          TIMEOUTS.MUTATION
        );

        if (updateResult.error) throw updateResult.error;
        return true;
      } catch (err) {
        logger.error("Error updating task position", {
          taskId,
          newStatus,
          newPosition,
          error: err
        });
        toast.error("Failed to move task");
        return false;
      }
    },
    []
  );

  /**
   * Reorder all tasks in a column after drag-drop
   */
  const reorderTasks = useCallback(
    async (
      tasksToUpdate: Array<{ id: string; position: number; status: TaskStatus }>
    ): Promise<boolean> => {
      try {
        const supabase = getClient();

        // Update each task's position
        const updates = tasksToUpdate.map((task) =>
          supabase
            .from("tasks")
            .update({
              position: task.position,
              status: task.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", task.id)
        );

        await Promise.all(updates);
        return true;
      } catch (err) {
        logger.error("Error reordering tasks", {
          taskCount: tasksToUpdate.length,
          error: err
        });
        toast.error("Failed to reorder tasks");
        return false;
      }
    },
    []
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const deleteResult = await withTimeout(
          supabase.from("tasks").delete().eq("id", taskId).then(res => res),
          TIMEOUTS.MUTATION
        );

        if (deleteResult.error) throw deleteResult.error;

        // Invalidate tasks list and single task cache
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        queryClient.invalidateQueries({ queryKey: singleTaskKeys.detail(taskId) });

        toast.success("Task deleted successfully");
        return true;
      } catch (err) {
        logger.error("Error deleting task", {
          taskId,
          error: err
        });
        toast.error("Failed to delete task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const archiveTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const archiveResult = await withTimeout(
          supabase
            .from("tasks")
            .update({
              is_archived: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId)
            .then(res => res),
          TIMEOUTS.MUTATION
        );

        if (archiveResult.error) throw archiveResult.error;

        // Invalidate tasks list
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

        toast.success("Task archived successfully");
        return true;
      } catch (err) {
        logger.error("Error archiving task", {
          taskId,
          error: err
        });
        toast.error("Failed to archive task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const markAsDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const markResult = await withTimeout(
          supabase
            .from("tasks")
            .update({
              is_duplicate: isDuplicate,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId)
            .then(res => res),
          TIMEOUTS.MUTATION
        );

        if (markResult.error) throw markResult.error;

        // Invalidate tasks list
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

        toast.success(
          isDuplicate ? "Task marked as duplicate" : "Duplicate flag removed"
        );
        return true;
      } catch (err) {
        logger.error("Error updating duplicate status", {
          taskId,
          isDuplicate,
          error: err
        });
        toast.error("Failed to update task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createTask,
    updateTask,
    updateTaskPosition,
    reorderTasks,
    deleteTask,
    archiveTask,
    markAsDuplicate,
    loading,
  };
}
