"use client";

/**
 * Task Data Hooks
 *
 * Custom hooks for fetching and mutating task data.
 * Includes optimistic updates for drag-and-drop operations.
 * Tasks are filtered by user access through their projects.
 *
 * Integrates with App Recovery system for:
 * - Timeout protection on all queries
 * - Automatic refetch after backgrounding
 * - Mutation queueing during degraded state
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS, isTimeoutError } from "@/lib/utils/with-timeout";
import { useAuth } from "@/hooks/use-auth";
import { useRecoveryState, useRecoveryRefresh } from "@/hooks/use-recovery";
import {
  mutationQueue,
  shouldQueueMutation,
} from "@/lib/app-recovery/mutation-queue";
import type { Task, TaskWithProject, TaskStatus } from "@/types";
import type { TaskInsert, TaskUpdate } from "@/types/database";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validation";
import { toast } from "sonner";

/**
 * Hook to fetch all tasks (non-archived)
 * Only fetches tasks that belong to projects the user has access to
 */
export function useTasks() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { status: recoveryStatus, isRecovering } = useRecoveryState();

  // Track if this is the initial load (for showing skeletons)
  const isInitialLoad = useRef(true);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    // Don't clear data during recovery - keep cached visible
    if (isRecovering) {
      console.log("[useTasks] Skipping fetch during recovery, keeping cached data");
      return;
    }

    try {
      // Only show loading on initial load, not on refetch
      if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);

      const supabase = getClient();

      // First get project IDs where user is creator or member
      const memberResult = await withTimeout(
        supabase.from("project_members").select("project_id").eq("user_id", user.id).then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching member projects timed out"
      );

      if (memberResult.error) {
        console.error("Error fetching member projects:", memberResult.error);
      }

      const memberProjectIds = memberResult.data?.map((m: { project_id: string }) => m.project_id) || [];

      // Get projects created by user
      const ownedResult = await withTimeout(
        supabase.from("projects").select("id").eq("created_by", user.id).then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching owned projects timed out"
      );

      if (ownedResult.error) {
        console.error("Error fetching owned projects:", ownedResult.error);
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
        query = query.eq("created_by", user.id);
      } else {
        // Fetch tasks from accessible projects OR created by user
        query = query.or(
          `project_id.in.(${accessibleProjectIds.join(",")}),created_by.eq.${user.id}`
        );
      }

      const tasksResult = await withTimeout(
        query.order("position", { ascending: true }).then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching tasks timed out"
      );

      if (tasksResult.error) {
        console.error("Supabase error details:", tasksResult.error);
        throw tasksResult.error;
      }

      setTasks((tasksResult.data as TaskWithProject[]) || []);
      isInitialLoad.current = false;
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("[useTasks] Fetch timed out, keeping cached data");
        // On timeout, keep cached data visible
        if (tasks.length > 0) {
          // We have cached data, just log and continue
          return;
        }
      }
      console.error("Error fetching tasks:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch tasks"));
    } finally {
      setLoading(false);
    }
  }, [user, isRecovering, tasks.length]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Subscribe to recovery refresh signals
  useRecoveryRefresh(fetchTasks);

  return {
    tasks,
    loading: loading && isInitialLoad.current, // Only show loading on initial
    error,
    refetch: fetchTasks,
    setTasks, // Expose for optimistic updates
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
 * Includes mutation queueing for degraded/recovering states
 */
export function useTaskMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { status: recoveryStatus } = useRecoveryState();

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in to create a task");
        return null;
      }

      const supabase = getClient();

      // The actual create operation
      const doCreate = async (): Promise<Task> => {
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
        return insertResult.data as Task;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doCreate, {
          description: "Create task",
          onSuccess: () => toast.success("Task created successfully"),
          onError: () => toast.error("Failed to create task"),
        });
        toast.info("Task will be created when connection restores");
        return null;
      }

      // Execute immediately
      try {
        setLoading(true);
        const result = await doCreate();
        toast.success("Task created successfully");
        return result;
      } catch (err: unknown) {
        const supabaseError = err as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        console.error("Error creating task:", {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
          raw: err,
        });
        toast.error(supabaseError.message || "Failed to create task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, recoveryStatus]
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
      const supabase = getClient();

      // The actual update operation
      const doUpdate = async (): Promise<Task> => {
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
        return updateResult.data as Task;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doUpdate, {
          description: "Update task",
          onError: () => toast.error("Failed to update task"),
        });
        toast.info("Change queued, will save when connection restores");
        return null;
      }

      // Execute immediately
      try {
        setLoading(true);
        const result = await doUpdate();
        return result;
      } catch (err: unknown) {
        const supabaseError = err as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        console.error("Error updating task:", {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
          raw: err,
        });
        toast.error(supabaseError.message || "Failed to update task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [recoveryStatus]
  );

  /**
   * Update task position and status (for drag-and-drop)
   * Uses optimistic update pattern
   */
  const updateTaskPosition = useCallback(
    async (taskId: string, newStatus: TaskStatus, newPosition: number): Promise<boolean> => {
      const supabase = getClient();

      const doUpdate = async (): Promise<boolean> => {
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
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doUpdate, {
          description: "Move task",
          onError: () => toast.error("Failed to move task"),
        });
        return true; // Return true since optimistic update already applied
      }

      try {
        return await doUpdate();
      } catch (err) {
        console.error("Error updating task position:", err);
        toast.error("Failed to move task");
        return false;
      }
    },
    [recoveryStatus]
  );

  /**
   * Reorder all tasks in a column after drag-drop
   */
  const reorderTasks = useCallback(
    async (
      tasksToUpdate: Array<{ id: string; position: number; status: TaskStatus }>
    ): Promise<boolean> => {
      const supabase = getClient();

      const doReorder = async (): Promise<boolean> => {
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
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doReorder, {
          description: "Reorder tasks",
          onError: () => toast.error("Failed to reorder tasks"),
        });
        return true; // Return true since optimistic update already applied
      }

      try {
        return await doReorder();
      } catch (err) {
        console.error("Error reordering tasks:", err);
        toast.error("Failed to reorder tasks");
        return false;
      }
    },
    [recoveryStatus]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const supabase = getClient();

      const doDelete = async (): Promise<boolean> => {
        const deleteResult = await withTimeout(
          supabase.from("tasks").delete().eq("id", taskId).then(res => res),
          TIMEOUTS.MUTATION
        );

        if (deleteResult.error) throw deleteResult.error;
        return true;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doDelete, {
          description: "Delete task",
          onSuccess: () => toast.success("Task deleted successfully"),
          onError: () => toast.error("Failed to delete task"),
        });
        toast.info("Task will be deleted when connection restores");
        return true;
      }

      try {
        setLoading(true);
        await doDelete();
        toast.success("Task deleted successfully");
        return true;
      } catch (err) {
        console.error("Error deleting task:", err);
        toast.error("Failed to delete task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [recoveryStatus]
  );

  const archiveTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const supabase = getClient();

      const doArchive = async (): Promise<boolean> => {
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
        return true;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doArchive, {
          description: "Archive task",
          onSuccess: () => toast.success("Task archived successfully"),
          onError: () => toast.error("Failed to archive task"),
        });
        toast.info("Task will be archived when connection restores");
        return true;
      }

      try {
        setLoading(true);
        await doArchive();
        toast.success("Task archived successfully");
        return true;
      } catch (err) {
        console.error("Error archiving task:", err);
        toast.error("Failed to archive task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [recoveryStatus]
  );

  const markAsDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean): Promise<boolean> => {
      const supabase = getClient();

      const doMark = async (): Promise<boolean> => {
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
        return true;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doMark, {
          description: isDuplicate ? "Mark as duplicate" : "Remove duplicate flag",
          onSuccess: () =>
            toast.success(
              isDuplicate ? "Task marked as duplicate" : "Duplicate flag removed"
            ),
          onError: () => toast.error("Failed to update task"),
        });
        toast.info("Change queued, will save when connection restores");
        return true;
      }

      try {
        setLoading(true);
        await doMark();
        toast.success(
          isDuplicate ? "Task marked as duplicate" : "Duplicate flag removed"
        );
        return true;
      } catch (err) {
        console.error("Error updating duplicate status:", err);
        toast.error("Failed to update task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [recoveryStatus]
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
