"use client";

/**
 * Task Data Hooks
 *
 * Custom hooks for fetching and mutating task data.
 * Includes optimistic updates for drag-and-drop operations.
 * Tasks are filtered by user access through their projects.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Task, TaskWithProject, TaskStatus } from "@/types";
import type { TaskInsert, TaskUpdate } from "@/types/database";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/validation";
import { toast } from "sonner";
import { withTimeout } from "@/lib/utils";

/**
 * Hook to fetch all tasks (non-archived)
 * Only fetches tasks that belong to projects the user has access to
 */
export function useTasks() {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const isFetching = useRef(false);

  const supabase = createClient();

  const fetchTasks = useCallback(async (isBackgroundRefresh = false) => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      // Only show loading state for initial/explicit fetches, not background refreshes
      if (!isBackgroundRefresh) {
        setLoading(true);
      }
      setError(null);

      // First get project IDs where user is creator or member (with timeout)
      const { data: memberProjects, error: memberError } = await withTimeout(
        supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id)
      );

      if (memberError) {
        console.error("Error fetching member projects:", memberError);
      }

      const memberProjectIds = memberProjects?.map((m) => m.project_id) || [];

      // Get projects created by user (with timeout)
      const { data: ownedProjects, error: ownedError } = await withTimeout(
        supabase
          .from("projects")
          .select("id")
          .eq("created_by", user.id)
      );

      if (ownedError) {
        console.error("Error fetching owned projects:", ownedError);
      }

      const ownedProjectIds = ownedProjects?.map((p) => p.id) || [];

      // Combine all project IDs user has access to
      const accessibleProjectIds = [...new Set([...memberProjectIds, ...ownedProjectIds])];

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
        query = query.or(`project_id.in.(${accessibleProjectIds.join(",")}),created_by.eq.${user.id}`);
      }

      // Wrap the main query with timeout
      const { data, error: fetchError } = await withTimeout(
        query.order("position", { ascending: true })
      );

      if (fetchError) {
        console.error("Supabase error details:", fetchError);
        throw fetchError;
      }

      setTasks(data as TaskWithProject[] || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch tasks";
      setError(err instanceof Error ? err : new Error(errorMessage));

      // Show toast for timeout errors so user knows to refresh
      if (errorMessage.includes("timed out")) {
        toast.error("Connection timed out. Please refresh the page.");
      }
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [supabase, user]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refetch when app becomes visible again (handles mobile backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        // Background refresh - don't show loading state
        fetchTasks(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchTasks, user]);

  return {
    tasks,
    loading,
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
 */
export function useTaskMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in to create a task");
        return null;
      }

      try {
        setLoading(true);

        // Validate input
        const validated = createTaskSchema.parse(input);

        // Get the highest position for the status column
        const { data: existingTasks } = await supabase
          .from("tasks")
          .select("position")
          .eq("status", validated.status)
          .order("position", { ascending: false })
          .limit(1);

        const maxPosition = existingTasks?.[0]?.position ?? -1;

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

        const { data, error } = await supabase
          .from("tasks")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        toast.success("Task created successfully");
        return data as Task;
      } catch (err: unknown) {
        const supabaseError = err as { message?: string; code?: string; details?: string; hint?: string };
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
    [supabase, user]
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
      try {
        setLoading(true);

        // Validate input
        const validated = updateTaskSchema.parse(input);

        const updateData: TaskUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("tasks")
          .update(updateData)
          .eq("id", taskId)
          .select()
          .single();

        if (error) throw error;

        return data as Task;
      } catch (err: unknown) {
        const supabaseError = err as { message?: string; code?: string; details?: string; hint?: string };
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
    [supabase]
  );

  /**
   * Update task position and status (for drag-and-drop)
   * Uses optimistic update pattern
   */
  const updateTaskPosition = useCallback(
    async (
      taskId: string,
      newStatus: TaskStatus,
      newPosition: number
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: newStatus,
            position: newPosition,
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Error updating task position:", err);
        toast.error("Failed to move task");
        return false;
      }
    },
    [supabase]
  );

  /**
   * Reorder all tasks in a column after drag-drop
   */
  const reorderTasks = useCallback(
    async (
      tasksToUpdate: Array<{ id: string; position: number; status: TaskStatus }>
    ): Promise<boolean> => {
      try {
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
        console.error("Error reordering tasks:", err);
        toast.error("Failed to reorder tasks");
        return false;
      }
    },
    [supabase]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId);

        if (error) throw error;

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
    [supabase]
  );

  const archiveTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("tasks")
          .update({
            is_archived: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (error) throw error;

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
    [supabase]
  );

  const markAsDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("tasks")
          .update({
            is_duplicate: isDuplicate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        if (error) throw error;

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
    [supabase]
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
