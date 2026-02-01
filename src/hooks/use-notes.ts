"use client";

/**
 * Notes Data Hooks
 *
 * Custom hooks for fetching and mutating notes data.
 * Notes are scoped to projects and can have linked tasks.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Note, NoteWithRelations, Task } from "@/types";
import type { NoteInsert, NoteUpdate, NoteTaskInsert } from "@/types/database";
import {
  createNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "@/lib/validation";
import { toast } from "sonner";

/**
 * Hook to fetch notes for a specific project
 */
export function useProjectNotes(projectId: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchNotes = useCallback(async () => {
    if (!projectId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("notes")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;

      setNotes((data as Note[]) || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch notes"));
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    setNotes,
    loading,
    error,
    refetch: fetchNotes,
  };
}

/**
 * Hook to fetch a single note with its linked tasks
 */
export function useNote(noteId: string | null) {
  const [note, setNote] = useState<NoteWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchNote = useCallback(async () => {
    if (!noteId) {
      setNote(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch note with project
      const { data: noteData, error: noteError } = await supabase
        .from("notes")
        .select(`
          *,
          project:projects(*)
        `)
        .eq("id", noteId)
        .single();

      if (noteError) throw noteError;

      // Fetch linked tasks via note_tasks junction table
      const { data: noteTasksData, error: noteTasksError } = await supabase
        .from("note_tasks")
        .select(`
          task_id,
          task:tasks(*, project:projects(*))
        `)
        .eq("note_id", noteId);

      if (noteTasksError) throw noteTasksError;

      // Extract tasks from the junction table results, filtering out archived tasks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tasks = (noteTasksData || [])
        .map((nt: any) => nt.task as Task | null)
        .filter((task): task is Task => task !== null && !task.is_archived);

      setNote({
        ...noteData,
        tasks,
      } as NoteWithRelations);
    } catch (err) {
      console.error("Error fetching note:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch note"));
    } finally {
      setLoading(false);
    }
  }, [noteId, supabase]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  return {
    note,
    setNote,
    loading,
    error,
    refetch: fetchNote,
  };
}

/**
 * Hook for note mutations (create, update, delete)
 */
export function useNoteMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note | null> => {
      if (!user) {
        toast.error("You must be logged in to create a note");
        return null;
      }

      try {
        setLoading(true);

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
    [supabase, user]
  );

  const updateNote = useCallback(
    async (noteId: string, input: UpdateNoteInput): Promise<Note | null> => {
      try {
        setLoading(true);

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

        return data as Note;
      } catch (err) {
        console.error("Error updating note:", err);
        toast.error("Failed to update note");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", noteId);

        if (error) throw error;

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
    [supabase]
  );

  /**
   * Create a task and link it to a note
   * The task is also automatically linked to the note's project
   */
  const createTaskFromNote = useCallback(
    async (
      noteId: string,
      projectId: string,
      taskData: { title: string; description?: string | null }
    ): Promise<Task | null> => {
      if (!user) {
        toast.error("You must be logged in to create a task");
        return null;
      }

      try {
        setLoading(true);

        // Create the task
        const { data: taskData2, error: taskError } = await supabase
          .from("tasks")
          .insert({
            project_id: projectId,
            title: taskData.title,
            description: taskData.description ?? null,
            status: "todo",
            priority: "medium",
            position: 0,
            created_by: user.id,
          })
          .select()
          .single();

        if (taskError) throw taskError;

        const task = taskData2 as Task;

        // Link task to note
        const noteTaskInsertData: NoteTaskInsert = {
          note_id: noteId,
          task_id: task.id,
        };

        const { error: linkError } = await supabase
          .from("note_tasks")
          .insert(noteTaskInsertData);

        if (linkError) throw linkError;

        toast.success("Task created");
        return task as Task;
      } catch (err) {
        console.error("Error creating task from note:", err);
        toast.error("Failed to create task");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [supabase, user]
  );

  /**
   * Link an existing task to a note
   */
  const linkTaskToNote = useCallback(
    async (noteId: string, taskId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase.from("note_tasks").insert({
          note_id: noteId,
          task_id: taskId,
        });

        if (error) throw error;

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
    [supabase]
  );

  /**
   * Unlink a task from a note (keeps the task, just removes the link)
   */
  const unlinkTaskFromNote = useCallback(
    async (noteId: string, taskId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("note_tasks")
          .delete()
          .eq("note_id", noteId)
          .eq("task_id", taskId);

        if (error) throw error;

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
    [supabase]
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
