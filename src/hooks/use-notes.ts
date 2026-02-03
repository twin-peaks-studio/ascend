"use client";

/**
 * Notes Data Hooks
 *
 * Custom hooks for fetching and mutating notes data.
 * Uses React Query for request deduplication and caching.
 * Notes are scoped to projects and can have linked tasks.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { useAuth } from "@/hooks/use-auth";
import type { Note, NoteWithRelations, Task } from "@/types";
import type { NoteInsert, NoteUpdate, NoteTaskInsert } from "@/types/database";
import { taskKeys } from "@/hooks/use-tasks";

/**
 * Type for the junction table query result when fetching tasks linked to a note.
 * Supabase returns this shape when we select `task:tasks(*)` from note_tasks.
 */
interface NoteTaskJoinResult {
  task_id: string;
  task: Task | null;
}

import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const noteKeys = {
  all: ["notes"] as const,
  lists: () => [...noteKeys.all, "list"] as const,
  list: (projectId: string) => [...noteKeys.lists(), projectId] as const,
  details: () => [...noteKeys.all, "detail"] as const,
  detail: (noteId: string) => [...noteKeys.details(), noteId] as const,
};

/**
 * Fetch notes for a project
 */
async function fetchProjectNotes(projectId: string): Promise<Note[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("notes")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching notes timed out"
  );

  if (result.error) throw result.error;
  return (result.data as Note[]) || [];
}

/**
 * Fetch a single note with linked tasks
 */
async function fetchNoteWithRelations(noteId: string): Promise<NoteWithRelations> {
  const supabase = getClient();

  // Fetch note with project
  const noteResult = await withTimeout(
    supabase
      .from("notes")
      .select(`
        *,
        project:projects(*)
      `)
      .eq("id", noteId)
      .single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching note timed out"
  );

  if (noteResult.error) throw noteResult.error;

  // Fetch linked tasks via note_tasks junction table
  const noteTasksResult = await withTimeout(
    supabase
      .from("note_tasks")
      .select(`
        task_id,
        task:tasks(*, project:projects(*))
      `)
      .eq("note_id", noteId),
    TIMEOUTS.DATA_QUERY,
    "Fetching note tasks timed out"
  );

  if (noteTasksResult.error) throw noteTasksResult.error;

  // Extract tasks from the junction table results, filtering out archived tasks
  const joinResults = (noteTasksResult.data || []) as unknown as NoteTaskJoinResult[];
  const tasks = joinResults
    .map((nt) => nt.task)
    .filter((task): task is Task => task !== null && !task.is_archived);

  return {
    ...noteResult.data,
    tasks,
  } as NoteWithRelations;
}

/**
 * Hook to fetch notes for a specific project
 * Uses React Query for deduplication
 */
export function useProjectNotes(projectId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: notes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: noteKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectNotes(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchOnWindowFocus: true,
  });

  return {
    notes,
    setNotes: (updater: Note[] | ((prev: Note[]) => Note[])) => {
      queryClient.setQueryData(
        noteKeys.list(projectId ?? ""),
        typeof updater === "function" ? updater(notes) : updater
      );
    },
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to fetch a single note with its linked tasks
 */
export function useNote(noteId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: note = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: noteKeys.detail(noteId ?? ""),
    queryFn: () => fetchNoteWithRelations(noteId!),
    enabled: !!noteId,
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    note,
    setNote: (updater: NoteWithRelations | null | ((prev: NoteWithRelations | null) => NoteWithRelations | null)) => {
      queryClient.setQueryData(
        noteKeys.detail(noteId ?? ""),
        typeof updater === "function" ? updater(note) : updater
      );
    },
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for note mutations (create, update, delete)
 */
export function useNoteMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note | null> => {
      if (!user) {
        toast.error("You must be logged in to create a note");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        const validated = createNoteSchema.parse(input);

        const insertData: NoteInsert = {
          project_id: validated.project_id,
          title: validated.title,
          content: validated.content ?? null,
          created_by: user.id,
        };

        const { data, error } = await supabase
          .from("notes")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        // Invalidate notes cache for this project
        queryClient.invalidateQueries({ queryKey: noteKeys.list(validated.project_id) });

        toast.success("Note created successfully");
        return data as Note;
      } catch (err) {
        console.error("Error creating note:", err);
        toast.error("Failed to create note");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateNote = useCallback(
    async (noteId: string, input: UpdateNoteInput, projectId?: string): Promise<Note | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const validated = updateNoteSchema.parse(input);

        const updateData: NoteUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("notes")
          .update(updateData)
          .eq("id", noteId)
          .select()
          .single();

        if (error) throw error;

        // Invalidate note detail cache
        queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });
        // Invalidate project notes list if projectId provided
        if (projectId) {
          queryClient.invalidateQueries({ queryKey: noteKeys.list(projectId) });
        }

        return data as Note;
      } catch (err) {
        console.error("Error updating note:", err);
        toast.error("Failed to update note");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteNote = useCallback(
    async (noteId: string, projectId?: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", noteId);

        if (error) throw error;

        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });
        if (projectId) {
          queryClient.invalidateQueries({ queryKey: noteKeys.list(projectId) });
        }

        toast.success("Note deleted successfully");
        return true;
      } catch (err) {
        console.error("Error deleting note:", err);
        toast.error("Failed to delete note");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  /**
   * Create a task and link it to a note
   * The task is also automatically linked to the note's project
   */
  const createTaskFromNote = useCallback(
    async (
      noteId: string,
      projectId: string,
      taskData: {
        title: string;
        description?: string | null;
        priority?: "low" | "medium" | "high" | "urgent";
        source_type?: "manual" | "ai_extraction";
      }
    ): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in to create a task");
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
            title: taskData.title,
            description: taskData.description ?? null,
            status: "todo",
            priority: taskData.priority ?? "medium",
            position: 0,
            created_by: user.id,
            assignee_id: user.id,
            source_type: taskData.source_type ?? "manual",
          })
          .select()
          .single();

        if (taskError) throw taskError;

        const task = taskResult as Task;

        // Link task to note
        const noteTaskInsertData: NoteTaskInsert = {
          note_id: noteId,
          task_id: task.id,
        };

        const { error: linkError } = await supabase
          .from("note_tasks")
          .insert(noteTaskInsertData);

        if (linkError) throw linkError;

        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

        toast.success("Task created");
        return task;
      } catch (err) {
        console.error("Error creating task from note:", err);
        toast.error("Failed to create task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  /**
   * Link an existing task to a note
   */
  const linkTaskToNote = useCallback(
    async (noteId: string, taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase.from("note_tasks").insert({
          note_id: noteId,
          task_id: taskId,
        });

        if (error) throw error;

        // Invalidate note detail cache
        queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });

        toast.success("Task linked to note");
        return true;
      } catch (err) {
        console.error("Error linking task to note:", err);
        toast.error("Failed to link task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  /**
   * Unlink a task from a note (keeps the task, just removes the link)
   */
  const unlinkTaskFromNote = useCallback(
    async (noteId: string, taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase
          .from("note_tasks")
          .delete()
          .eq("note_id", noteId)
          .eq("task_id", taskId);

        if (error) throw error;

        // Invalidate note detail cache
        queryClient.invalidateQueries({ queryKey: noteKeys.detail(noteId) });

        toast.success("Task unlinked from note");
        return true;
      } catch (err) {
        console.error("Error unlinking task:", err);
        toast.error("Failed to unlink task");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createNote,
    updateNote,
    deleteNote,
    createTaskFromNote,
    linkTaskToNote,
    unlinkTaskFromNote,
    loading,
  };
}
