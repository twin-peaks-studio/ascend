"use client";

/**
 * Task Extraction Hook
 *
 * Manages the AI task extraction flow:
 * 1. Extract tasks from content via API
 * 2. Review and edit extracted tasks
 * 3. Create selected tasks and link to source
 *
 * Supports two modes:
 * - Note mode: all tasks go to a single project (sourceProjectId)
 * - Capture mode: each task can be assigned to a different project (per-task projectId)
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { useAuth } from "@/hooks/use-auth";
import { noteKeys } from "@/hooks/use-notes";
import { captureKeys } from "@/hooks/use-captures";
import { taskKeys } from "@/hooks/use-tasks";
import { projectKeys } from "@/hooks/use-projects";
import { toast } from "sonner";
import { logger } from "@/lib/logger/logger";
import type {
  ExtractedTask,
  RawExtractedTask,
  ExtractionStatus,
  ExtractionError,
  ExtractionEntity,
  ExtractTasksResponse,
  UseTaskExtractionReturn,
  TaskSourceType,
} from "@/lib/ai/types";
import type { Task } from "@/types";

/**
 * Generate a unique ID for extracted tasks (client-side only)
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Convert raw AI tasks to client tasks with UI state.
 * Merges sourceText into the description so the user reviews
 * and edits the full combined text as one field.
 */
function toClientTasks(rawTasks: RawExtractedTask[], defaultProjectId?: string): ExtractedTask[] {
  return rawTasks.map((task) => {
    const mergedDescription = task.sourceText
      ? [task.description, `Original Content: ${task.sourceText}`]
          .filter(Boolean)
          .join("\n\n")
      : task.description;

    return {
      ...task,
      description: mergedDescription,
      id: generateId(),
      selected: true, // Select all by default
      projectId: defaultProjectId,
    };
  });
}

/**
 * Hook for managing AI task extraction flow
 */
export function useTaskExtraction(): UseTaskExtractionReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [status, setStatus] = useState<ExtractionStatus>("idle");
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [error, setError] = useState<ExtractionError | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [sourceNoteId, setSourceNoteId] = useState<string | null>(null);
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
  const [sourceEntities, setSourceEntities] = useState<ExtractionEntity[]>([]);

  /**
   * Extract tasks from a note's content
   */
  const extractFromNote = useCallback(
    async (
      noteId: string,
      content: string,
      projectId: string,
      projectTitle?: string,
      entities?: ExtractionEntity[]
    ): Promise<void> => {
      if (!user) {
        toast.error("You must be logged in to extract tasks");
        return;
      }

      if (!content.trim()) {
        setError({ type: "empty_content", message: "Note content is empty" });
        setStatus("error");
        return;
      }

      setStatus("extracting");
      setError(null);
      setSourceNoteId(noteId);
      setSourceProjectId(projectId);
      setSourceEntities(entities ?? []);

      try {
        const response = await fetch("/api/ai/extract-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "note",
            sourceId: noteId,
            content,
            projectId,
            projectTitle,
            entities,
          }),
        });

        const data: ExtractTasksResponse = await response.json();

        if (!data.success) {
          setError(data.error);
          setStatus("error");

          // Show user-friendly error messages
          if (data.error.type === "rate_limit") {
            const retryAfter = data.error.retryAfter || 60;
            const retryMinutes = Math.ceil(retryAfter / 60);
            toast.error(
              `Rate limit exceeded. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`,
              { duration: 5000 }
            );
          } else if (data.error.type === "timeout") {
            toast.error("Request timed out. Please try again.");
          } else if (data.error.type === "empty_content") {
            toast.error("Note content is empty");
          } else {
            toast.error(data.error.message || "Failed to extract tasks");
          }

          return;
        }

        if (data.tasks.length === 0) {
          toast.info("No actionable tasks found in this note");
          setStatus("idle");
          return;
        }

        setExtractedTasks(toClientTasks(data.tasks, projectId));
        setStatus("reviewing");
      } catch (err) {
        logger.error("Task extraction failed", {
          userId: user.id,
          noteId,
          projectId,
          error: err
        });
        setError({
          type: "api_error",
          message: "Failed to connect to AI service",
        });
        setStatus("error");
      }
    },
    [user]
  );

  /**
   * Extract tasks from a capture's content.
   * Unlike notes, captures may not have a fixed project — tasks get per-task project assignment.
   */
  const extractFromCapture = useCallback(
    async (
      captureId: string,
      content: string,
      defaultProjectId?: string,
      projectTitle?: string,
      entities?: ExtractionEntity[]
    ): Promise<void> => {
      if (!user) {
        toast.error("You must be logged in to extract tasks");
        return;
      }

      if (!content.trim()) {
        setError({ type: "empty_content", message: "Capture content is empty" });
        setStatus("error");
        return;
      }

      setStatus("extracting");
      setError(null);
      setSourceNoteId(captureId);
      setSourceProjectId(defaultProjectId ?? null);
      setSourceEntities(entities ?? []);

      try {
        const response = await fetch("/api/ai/extract-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "note", // API treats captures same as notes
            sourceId: captureId,
            content,
            projectId: defaultProjectId,
            projectTitle,
            entities,
          }),
        });

        const data: ExtractTasksResponse = await response.json();

        if (!data.success) {
          setError(data.error);
          setStatus("error");

          if (data.error.type === "rate_limit") {
            const retryAfter = data.error.retryAfter || 60;
            const retryMinutes = Math.ceil(retryAfter / 60);
            toast.error(
              `Rate limit exceeded. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`,
              { duration: 5000 }
            );
          } else if (data.error.type === "timeout") {
            toast.error("Request timed out. Please try again.");
          } else if (data.error.type === "empty_content") {
            toast.error("Capture content is empty");
          } else {
            toast.error(data.error.message || "Failed to extract tasks");
          }

          return;
        }

        if (data.tasks.length === 0) {
          toast.info("No actionable tasks found in this capture");
          setStatus("idle");
          return;
        }

        setExtractedTasks(toClientTasks(data.tasks, defaultProjectId));
        setStatus("reviewing");
      } catch (err) {
        logger.error("Task extraction from capture failed", {
          userId: user.id,
          captureId,
          error: err
        });
        setError({
          type: "api_error",
          message: "Failed to connect to AI service",
        });
        setStatus("error");
      }
    },
    [user]
  );

  /**
   * Update an extracted task's properties
   */
  const updateTask = useCallback(
    (id: string, updates: Partial<ExtractedTask>): void => {
      setExtractedTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
      );
    },
    []
  );

  /**
   * Toggle task selection
   */
  const toggleSelection = useCallback((id: string): void => {
    setExtractedTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, selected: !task.selected } : task
      )
    );
  }, []);

  /**
   * Select all tasks
   */
  const selectAll = useCallback((): void => {
    setExtractedTasks((prev) => prev.map((task) => ({ ...task, selected: true })));
  }, []);

  /**
   * Deselect all tasks
   */
  const deselectAll = useCallback((): void => {
    setExtractedTasks((prev) => prev.map((task) => ({ ...task, selected: false })));
  }, []);

  /**
   * Create all selected tasks and link them to the source note/capture.
   * Uses per-task projectId when available, falling back to sourceProjectId.
   */
  const createSelectedTasks = useCallback(async (): Promise<void> => {
    if (!user || !sourceNoteId) {
      toast.error("Missing required information to create tasks");
      return;
    }

    const selectedTasks = extractedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      toast.error("No tasks selected");
      return;
    }

    // Validate that all selected tasks have a project
    const tasksWithoutProject = selectedTasks.filter(
      (t) => !t.projectId && !sourceProjectId
    );
    if (tasksWithoutProject.length > 0) {
      toast.error("All tasks must be assigned to a project");
      return;
    }

    setStatus("creating");
    setCreatedCount(0);

    const supabase = getClient();
    let successCount = 0;

    for (const task of selectedTasks) {
      const taskProjectId = task.projectId || sourceProjectId;
      if (!taskProjectId) continue;

      try {
        // Create the task with source_type
        const { data: taskResult, error: taskError } = await supabase
          .from("tasks")
          .insert({
            project_id: taskProjectId,
            title: task.title,
            description: task.description ?? null,
            status: "todo",
            priority: task.priority,
            position: 0,
            created_by: user.id,
            assignee_id: user.id,
            source_type: "ai_extraction" as TaskSourceType,
          })
          .select()
          .single();

        if (taskError) {
          logger.error("Failed to create task from extraction", {
            userId: user.id,
            projectId: taskProjectId,
            taskTitle: task.title,
            error: taskError
          });
          continue;
        }

        const createdTask = taskResult as Task;

        // Link task to note/capture
        const { error: linkError } = await supabase
          .from("note_tasks")
          .insert({
            note_id: sourceNoteId,
            task_id: createdTask.id,
          });

        if (linkError) {
          logger.error("Failed to link task to source", {
            userId: user.id,
            noteId: sourceNoteId,
            taskId: createdTask.id,
            error: linkError
          });
        }

        // Link task to entities (from AI suggestions + user edits)
        if (task.entityIds.length > 0) {
          const entityTypeMap = new Map(
            sourceEntities.map((e) => [e.id, e.type])
          );
          const entityRows = task.entityIds
            .filter((eid) => entityTypeMap.has(eid))
            .map((eid) => ({
              task_id: createdTask.id,
              entity_id: eid,
              entity_type: entityTypeMap.get(eid)!,
            }));

          if (entityRows.length > 0) {
            const { error: entityLinkError } = await supabase
              .from("task_entities")
              .insert(entityRows);

            if (entityLinkError) {
              logger.error("Failed to link task to entities", {
                userId: user.id,
                taskId: createdTask.id,
                entityIds: task.entityIds,
                error: entityLinkError
              });
            }
          }
        }

        successCount++;
        setCreatedCount(successCount);
      } catch (err) {
        logger.error("Error creating task from extraction", {
          userId: user.id,
          projectId: taskProjectId,
          taskTitle: task.title,
          error: err
        });
      }
    }

    // Invalidate caches — note, capture, task list, and project detail keys
    queryClient.invalidateQueries({ queryKey: noteKeys.detail(sourceNoteId) });
    queryClient.invalidateQueries({ queryKey: captureKeys.detail(sourceNoteId) });
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    queryClient.invalidateQueries({ queryKey: projectKeys.details() });

    if (successCount === selectedTasks.length) {
      toast.success(`Created ${successCount} task${successCount !== 1 ? "s" : ""}`);
      setStatus("success");
    } else if (successCount > 0) {
      toast.warning(
        `Created ${successCount} of ${selectedTasks.length} tasks`
      );
      setStatus("success");
    } else {
      toast.error("Failed to create tasks");
      setStatus("error");
      setError({ type: "api_error", message: "Failed to create tasks" });
    }
  }, [user, sourceNoteId, sourceProjectId, extractedTasks, sourceEntities, queryClient]);

  /**
   * Reset the extraction state
   */
  const reset = useCallback((): void => {
    setStatus("idle");
    setExtractedTasks([]);
    setError(null);
    setCreatedCount(0);
    setSourceNoteId(null);
    setSourceProjectId(null);
    setSourceEntities([]);
  }, []);

  return {
    // State
    status,
    extractedTasks,
    error,
    createdCount,
    sourceNoteId,
    sourceProjectId,
    sourceEntities,
    // Actions
    extractFromNote,
    extractFromCapture,
    updateTask,
    toggleSelection,
    selectAll,
    deselectAll,
    createSelectedTasks,
    reset,
  };
}
