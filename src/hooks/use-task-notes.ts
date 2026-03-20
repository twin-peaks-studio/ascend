"use client";

/**
 * Hook to fetch notes/captures linked to a task via the note_tasks junction table.
 * Returns both standard notes (capture_type IS NULL) and captures.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { CaptureType } from "@/types";

export interface LinkedNote {
  id: string;
  title: string;
  capture_type: CaptureType | null;
  project_id: string | null;
  workspace_id: string | null;
}

interface NoteTaskJoinRow {
  note_id: string;
  note: LinkedNote | null;
}

export const taskNoteKeys = {
  all: ["task-notes"] as const,
  list: (taskId: string) => [...taskNoteKeys.all, taskId] as const,
};

async function fetchTaskNotes(taskId: string): Promise<LinkedNote[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("note_tasks")
      .select(`
        note_id,
        note:notes(id, title, capture_type, project_id, workspace_id)
      `)
      .eq("task_id", taskId),
    TIMEOUTS.DATA_QUERY,
    "Fetching task notes timed out"
  );

  const { data, error } = result as { data: NoteTaskJoinRow[] | null; error: { message: string } | null };

  if (error) {
    logger.error("Error fetching task notes", { taskId, error });
    throw error;
  }

  const rows = (data || []) as NoteTaskJoinRow[];
  return rows
    .map((r) => r.note)
    .filter((n): n is LinkedNote => n !== null);
}

export function useTaskNotes(taskId: string | null) {
  const {
    data: notes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: taskNoteKeys.list(taskId ?? ""),
    queryFn: () => fetchTaskNotes(taskId!),
    enabled: !!taskId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    notes,
    loading: isLoading,
    error: error as Error | null,
  };
}
