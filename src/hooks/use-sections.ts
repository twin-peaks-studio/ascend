"use client";

/**
 * Section Data Hooks
 *
 * Custom hooks for fetching and mutating section data.
 * Sections are project-scoped groupings for tasks in list view.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { taskKeys } from "@/hooks/use-tasks";
import { projectKeys } from "@/hooks/use-projects";
import type { Section, Task, TaskWithProject } from "@/types";
import type { SectionInsert, SectionUpdate } from "@/types/database";
import {
  createSectionSchema,
  updateSectionSchema,
  type CreateSectionInput,
  type UpdateSectionInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const sectionKeys = {
  all: ["sections"] as const,
  lists: () => [...sectionKeys.all, "list"] as const,
  list: (projectId: string) => [...sectionKeys.lists(), projectId] as const,
};

/**
 * Fetch all active sections for a project
 */
async function fetchSectionsForProject(projectId: string): Promise<Section[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("sections")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching sections timed out"
  );

  if (result.error) {
    logger.error("Error fetching sections", {
      projectId,
      error: result.error,
    });
    throw result.error;
  }

  return (result.data as Section[]) || [];
}

/**
 * Hook to fetch all sections for a project
 */
export function useSections(projectId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: sections = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: sectionKeys.list(projectId ?? ""),
    queryFn: () => fetchSectionsForProject(projectId!),
    enabled: !!projectId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    sections,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    setSections: (
      updater: Section[] | ((prev: Section[]) => Section[])
    ) => {
      queryClient.setQueryData(
        sectionKeys.list(projectId ?? ""),
        typeof updater === "function" ? updater(sections) : updater
      );
    },
  };
}

/**
 * Hook for section mutations (create, update, delete, reorder)
 */
export function useSectionMutations() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const createSection = useCallback(
    async (input: CreateSectionInput): Promise<Section | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const validated = createSectionSchema.parse(input);

        const insertData: SectionInsert = {
          project_id: validated.project_id,
          name: validated.name,
          position: validated.position,
        };

        const insertResult = await withTimeout(
          supabase
            .from("sections")
            .insert(insertData)
            .select()
            .single()
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (insertResult.error) throw insertResult.error;

        // Invalidate sections list to refetch (needs server-generated ID)
        queryClient.invalidateQueries({
          queryKey: sectionKeys.list(validated.project_id),
        });

        toast.success("Section created");
        return insertResult.data as Section;
      } catch (err: unknown) {
        const error = err as { message?: string };
        logger.error("Error creating section", { error });
        toast.error(error.message || "Failed to create section");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const updateSection = useCallback(
    async (
      sectionId: string,
      projectId: string,
      input: UpdateSectionInput
    ): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const validated = updateSectionSchema.parse(input);

        const updateData: SectionUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const updateResult = await withTimeout(
          supabase
            .from("sections")
            .update(updateData)
            .eq("id", sectionId)
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (updateResult.error) throw updateResult.error;

        // Update in-place in cache (preserves order, no refetch)
        queryClient.setQueryData<Section[]>(
          sectionKeys.list(projectId),
          (old) =>
            old
              ? old.map((s) =>
                  s.id === sectionId ? { ...s, ...updateData } : s
                )
              : []
        );

        return true;
      } catch (err: unknown) {
        const error = err as { message?: string };
        logger.error("Error updating section", { sectionId, error });
        toast.error(error.message || "Failed to update section");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteSection = useCallback(
    async (sectionId: string, projectId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const deleteResult = await withTimeout(
          supabase
            .from("sections")
            .delete()
            .eq("id", sectionId)
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (deleteResult.error) throw deleteResult.error;

        // Remove section from cache
        queryClient.setQueryData<Section[]>(
          sectionKeys.list(projectId),
          (old) => (old ? old.filter((s) => s.id !== sectionId) : [])
        );

        // Null out section_id on tasks that were in this section (global tasks cache)
        queryClient.setQueriesData<TaskWithProject[]>(
          { queryKey: taskKeys.lists() },
          (old) =>
            old
              ? old.map((t) =>
                  t.section_id === sectionId
                    ? { ...t, section_id: null, section_position: 0 }
                    : t
                )
              : []
        );

        // Null out section_id on tasks in project detail cache
        queryClient.setQueriesData(
          { queryKey: projectKeys.details() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (old: any) => {
            if (!old?.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.map((t: Task) =>
                t.section_id === sectionId
                  ? { ...t, section_id: null, section_position: 0 }
                  : t
              ),
            };
          }
        );

        toast.success("Section deleted");
        return true;
      } catch (err: unknown) {
        const error = err as { message?: string };
        logger.error("Error deleting section", { sectionId, error });
        toast.error(error.message || "Failed to delete section");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const reorderSections = useCallback(
    async (
      projectId: string,
      updates: Array<{ id: string; position: number }>
    ): Promise<boolean> => {
      try {
        const supabase = getClient();

        const promises = updates.map((update) =>
          supabase
            .from("sections")
            .update({
              position: update.position,
              updated_at: new Date().toISOString(),
            })
            .eq("id", update.id)
        );

        await Promise.all(promises);

        // Update positions in cache
        queryClient.setQueryData<Section[]>(
          sectionKeys.list(projectId),
          (old) => {
            if (!old) return [];
            const positionMap = new Map(
              updates.map((u) => [u.id, u.position])
            );
            return old
              .map((s) => {
                const newPos = positionMap.get(s.id);
                return newPos !== undefined ? { ...s, position: newPos } : s;
              })
              .sort((a, b) => a.position - b.position);
          }
        );

        return true;
      } catch (err) {
        logger.error("Error reordering sections", { projectId, error: err });
        toast.error("Failed to reorder sections");
        return false;
      }
    },
    [queryClient]
  );

  const moveTaskToSection = useCallback(
    async (
      taskId: string,
      sectionId: string | null,
      sectionPosition: number
    ): Promise<boolean> => {
      try {
        const supabase = getClient();

        const updateResult = await withTimeout(
          supabase
            .from("tasks")
            .update({
              section_id: sectionId,
              section_position: sectionPosition,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId)
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (updateResult.error) throw updateResult.error;

        // Update task in-place in global tasks cache
        queryClient.setQueriesData<TaskWithProject[]>(
          { queryKey: taskKeys.lists() },
          (old) =>
            old
              ? old.map((t) =>
                  t.id === taskId
                    ? { ...t, section_id: sectionId, section_position: sectionPosition }
                    : t
                )
              : []
        );

        // Update task in project detail cache
        queryClient.setQueriesData(
          { queryKey: projectKeys.details() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (old: any) => {
            if (!old?.tasks) return old;
            return {
              ...old,
              tasks: old.tasks.map((t: Task) =>
                t.id === taskId
                  ? { ...t, section_id: sectionId, section_position: sectionPosition }
                  : t
              ),
            };
          }
        );

        return true;
      } catch (err) {
        logger.error("Error moving task to section", {
          taskId,
          sectionId,
          error: err,
        });
        toast.error("Failed to move task");
        return false;
      }
    },
    [queryClient]
  );

  return {
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    moveTaskToSection,
    loading,
  };
}
