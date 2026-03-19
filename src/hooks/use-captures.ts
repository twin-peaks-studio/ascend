"use client";

/**
 * Captures Data Hook
 *
 * Handles fetching and mutating captures (intelligence workspace notes).
 * Captures are notes with capture_type set, scoped to a workspace.
 * Separate from use-notes.ts to avoid coupling standard notes with capture logic.
 *
 * Captures support linked tasks via the note_tasks junction table (same as notes).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, useMemo } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { taskKeys } from "@/hooks/use-tasks";
import { enrichTasksWithEntities } from "@/lib/utils/enrich-task-entities";
import type { Note, Task, TaskWithProject, CaptureWithRelations, NoteTaskJoinResult } from "@/types";
import type { NoteInsert, NoteUpdate, Project } from "@/types/database";

/** Shape returned by Supabase when selecting `*, project:projects(*)` from notes. */
interface NoteWithProjectRow extends Note {
  project: Project | null;
}
import {
  createCaptureSchema,
  updateCaptureSchema,
  type CreateCaptureInput,
  type UpdateCaptureInput,
} from "@/lib/validation";
import { toast } from "sonner";


// Query keys for cache management
export const captureKeys = {
  all: ["captures"] as const,
  lists: () => [...captureKeys.all, "list"] as const,
  list: (workspaceId: string) => [...captureKeys.lists(), workspaceId] as const,
  details: () => [...captureKeys.all, "detail"] as const,
  detail: (id: string) => [...captureKeys.details(), id] as const,
};

/** A capture grouped by date for the daily journal view */
export interface CaptureDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Human-readable label: "Today", "Yesterday", "Monday, Mar 9" */
  label: string;
  captures: CaptureWithRelations[];
}

/**
 * Format a date into a human-readable day label
 */
function formatDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - target.getTime();
  const dayMs = 86400000;

  if (diff < dayMs) return "Today";
  if (diff < 2 * dayMs) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Fetch captures for a workspace, ordered by occurred_at/created_at desc.
 * List view does NOT fetch linked tasks (kept lightweight).
 */
async function fetchCaptures(
  workspaceId: string
): Promise<CaptureWithRelations[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("notes")
      .select(
        `
        *,
        project:projects(*)
      `
      )
      .eq("workspace_id", workspaceId)
      .not("capture_type", "is", null)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching captures timed out"
  );

  if (result.error) throw result.error;

  return ((result.data || []) as unknown as NoteWithProjectRow[]).map((row) => ({
    ...row,
    project: row.project ?? null,
    tasks: [], // List view doesn't load tasks
  })) as CaptureWithRelations[];
}

/**
 * Fetch a single capture by ID with project relation AND linked tasks
 */
async function fetchCaptureById(
  captureId: string
): Promise<CaptureWithRelations> {
  const supabase = getClient();

  // Fetch capture with project
  const result = await withTimeout(
    supabase
      .from("notes")
      .select(
        `
        *,
        project:projects(*)
      `
      )
      .eq("id", captureId)
      .single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching capture timed out"
  );

  if (result.error) throw result.error;

  // Fetch linked tasks via note_tasks junction table
  const noteTasksResult = await withTimeout(
    supabase
      .from("note_tasks")
      .select(`
        task_id,
        task:tasks(*, assignee:profiles(*), project:projects(*))
      `)
      .eq("note_id", captureId),
    TIMEOUTS.DATA_QUERY,
    "Fetching capture tasks timed out"
  );

  if (noteTasksResult.error) throw noteTasksResult.error;

  // Extract tasks, filtering out archived
  const joinResults = (noteTasksResult.data || []) as unknown as NoteTaskJoinResult[];
  const tasks = joinResults
    .map((nt) => nt.task)
    .filter((task): task is TaskWithProject => task !== null && !task.is_archived);

  // Enrich tasks with entity labels from task_entities
  await enrichTasksWithEntities(tasks);

  const data = result.data as unknown as NoteWithProjectRow;
  return {
    ...data,
    project: data.project ?? null,
    tasks,
  } as CaptureWithRelations;
}

/**
 * Hook to fetch captures for a workspace, grouped by day
 */
export function useCaptures(workspaceId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: captures = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: captureKeys.list(workspaceId ?? ""),
    queryFn: () => fetchCaptures(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Group captures by day
  const days: CaptureDay[] = useMemo(() => {
    const dayMap = new Map<string, CaptureWithRelations[]>();

    for (const capture of captures) {
      const dateStr = capture.occurred_at || capture.created_at;
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!dayMap.has(key)) {
        dayMap.set(key, []);
      }
      dayMap.get(key)!.push(capture);
    }

    // Sort days in reverse chronological order
    const sortedDays = Array.from(dayMap.entries()).sort(
      ([a], [b]) => b.localeCompare(a)
    );

    return sortedDays.map(([dateKey, dayCaptures]) => {
      // Sort captures within day by time ascending (earliest first)
      const sorted = [...dayCaptures].sort((a, b) => {
        const aTime = new Date(a.occurred_at || a.created_at).getTime();
        const bTime = new Date(b.occurred_at || b.created_at).getTime();
        return aTime - bTime;
      });

      return {
        date: dateKey,
        label: formatDayLabel(new Date(dateKey + "T12:00:00")),
        captures: sorted,
      };
    });
  }, [captures]);

  return {
    captures,
    days,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    setCaptures: (
      updater:
        | CaptureWithRelations[]
        | ((prev: CaptureWithRelations[]) => CaptureWithRelations[])
    ) => {
      queryClient.setQueryData(
        captureKeys.list(workspaceId ?? ""),
        typeof updater === "function" ? updater(captures) : updater
      );
    },
  };
}

/**
 * Hook to fetch a single capture with linked tasks
 */
export function useCapture(captureId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: capture = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: captureKeys.detail(captureId ?? ""),
    queryFn: () => fetchCaptureById(captureId!),
    enabled: !!captureId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    capture,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    setCapture: (
      updater:
        | CaptureWithRelations
        | null
        | ((
            prev: CaptureWithRelations | null
          ) => CaptureWithRelations | null)
    ) => {
      queryClient.setQueryData(
        captureKeys.detail(captureId ?? ""),
        typeof updater === "function" ? updater(capture) : updater
      );
    },
  };
}

/**
 * Hook for capture mutations (create, update, delete, task linking)
 */
export function useCaptureMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createCapture = useCallback(
    async (input: CreateCaptureInput): Promise<Note | null> => {
      if (!user) {
        toast.error("You must be logged in to create a capture");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        const validated = createCaptureSchema.parse(input);

        const insertData: NoteInsert = {
          workspace_id: validated.workspace_id,
          project_id: validated.project_id ?? null,
          title: validated.title,
          content: validated.content ?? null,
          capture_type: validated.capture_type,
          occurred_at: validated.occurred_at ?? new Date().toISOString(),
          created_by: user.id,
        };

        const { data, error } = await supabase
          .from("notes")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        // Invalidate captures list
        queryClient.invalidateQueries({
          queryKey: captureKeys.list(validated.workspace_id),
        });

        toast.success("Capture saved");
        return data as Note;
      } catch (err) {
        logger.error("Error creating capture", {
          userId: user.id,
          workspaceId: input.workspace_id,
          error: err,
        });
        toast.error("Failed to save capture");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateCapture = useCallback(
    async (
      captureId: string,
      input: UpdateCaptureInput,
      workspaceId?: string
    ): Promise<Note | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const validated = updateCaptureSchema.parse(input);

        const updateData: NoteUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("notes")
          .update(updateData)
          .eq("id", captureId)
          .select()
          .single();

        if (error) throw error;

        const updated = data as Note;

        // Invalidate caches
        queryClient.invalidateQueries({
          queryKey: captureKeys.detail(captureId),
        });
        if (workspaceId) {
          queryClient.setQueryData<CaptureWithRelations[]>(
            captureKeys.list(workspaceId),
            (old) =>
              old
                ? old.map((c) =>
                    c.id === captureId ? { ...c, ...updated } : c
                  )
                : old
          );
        }

        return updated;
      } catch (err) {
        logger.error("Error updating capture", {
          captureId,
          error: err,
        });
        toast.error("Failed to update capture");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteCapture = useCallback(
    async (captureId: string, workspaceId?: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", captureId);

        if (error) throw error;

        queryClient.setQueryData(captureKeys.detail(captureId), null);
        if (workspaceId) {
          queryClient.setQueryData<CaptureWithRelations[]>(
            captureKeys.list(workspaceId),
            (old) => (old ? old.filter((c) => c.id !== captureId) : old)
          );
        }

        toast.success("Capture deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting capture", {
          captureId,
          error: err,
        });
        toast.error("Failed to delete capture");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  /**
   * Create a task and link it to a capture via note_tasks.
   * The task is assigned to a specific project.
   */
  const createTaskFromCapture = useCallback(
    async (
      captureId: string,
      projectId: string,
      taskData: { title: string; description?: string }
    ): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        // Create the task
        const { data: taskResult, error: taskError } = await supabase
          .from("tasks")
          .insert({
            project_id: projectId,
            title: taskData.title.trim(),
            description: taskData.description ?? null,
            status: "todo",
            priority: "medium",
            position: 0,
            created_by: user.id,
            assignee_id: user.id,
            source_type: "manual",
          })
          .select()
          .single();

        if (taskError) throw taskError;

        const createdTask = taskResult as Task;

        // Link task to capture via note_tasks junction table
        const { error: linkError } = await supabase
          .from("note_tasks")
          .insert({
            note_id: captureId,
            task_id: createdTask.id,
          });

        if (linkError) {
          logger.error("Failed to link task to capture", {
            captureId,
            taskId: createdTask.id,
            error: linkError,
          });
        }

        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: captureKeys.detail(captureId) });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

        return createdTask;
      } catch (err) {
        logger.error("Error creating task from capture", {
          captureId,
          projectId,
          error: err,
        });
        toast.error("Failed to create task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  /**
   * Link an existing task to a capture
   */
  const linkTaskToCapture = useCallback(
    async (captureId: string, taskId: string): Promise<boolean> => {
      try {
        const supabase = getClient();

        const { error } = await supabase
          .from("note_tasks")
          .insert({
            note_id: captureId,
            task_id: taskId,
          });

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: captureKeys.detail(captureId) });
        return true;
      } catch (err) {
        logger.error("Error linking task to capture", {
          captureId,
          taskId,
          error: err,
        });
        toast.error("Failed to link task");
        return false;
      }
    },
    [queryClient]
  );

  return {
    createCapture,
    updateCapture,
    deleteCapture,
    createTaskFromCapture,
    linkTaskToCapture,
    loading,
  };
}
