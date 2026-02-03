"use client";

/**
 * Project Data Hooks
 *
 * Custom hooks for fetching and mutating project data.
 * Uses React Query for request deduplication, caching, and automatic refetching.
 * Projects are filtered by user access (owner or member).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { useAuth } from "@/hooks/use-auth";
import type { Project, ProjectWithRelations } from "@/types";
import type { ProjectInsert, ProjectUpdate } from "@/types/database";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (userId: string) => [...projectKeys.lists(), userId] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Fetch all projects for a user
 */
async function fetchProjectsForUser(userId: string): Promise<ProjectWithRelations[]> {
  const supabase = getClient();

  // First get project IDs where user is a member
  const memberResult = await withTimeout(
    supabase.from("project_members").select("project_id").eq("user_id", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching member projects timed out"
  );

  if (memberResult.error) {
    console.error("Error fetching member projects:", memberResult.error);
  }

  const memberProjectIds = memberResult.data?.map((m: { project_id: string }) => m.project_id) || [];

  // Build the query - fetch projects where user is creator OR is a member
  let query = supabase.from("projects").select(
    `
      *,
      tasks:tasks(*),
      documents:project_documents(*)
    `
  );

  // Build OR filter based on what IDs we have
  if (memberProjectIds.length > 0) {
    query = query.or(
      `created_by.eq.${userId},id.in.(${memberProjectIds.join(",")})`
    );
  } else {
    query = query.eq("created_by", userId);
  }

  const projectsResult = await withTimeout(
    query.order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching projects timed out"
  );

  if (projectsResult.error) {
    console.error("Supabase error details:", projectsResult.error);
    throw projectsResult.error;
  }

  // Transform data to match our types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((projectsResult.data || []) as any[]).map((project) => ({
    ...project,
    tasks: Array.isArray(project.tasks) ? project.tasks : [],
    documents: project.documents || [],
  }));
}

/**
 * Fetch a single project by ID
 */
async function fetchProjectById(projectId: string): Promise<ProjectWithRelations> {
  const supabase = getClient();

  const projectResult = await withTimeout(
    supabase
      .from("projects")
      .select(
        `
        *,
        tasks:tasks(*),
        documents:project_documents(*)
      `
      )
      .eq("id", projectId)
      .single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching project timed out"
  );

  if (projectResult.error) throw projectResult.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = projectResult.data as any;
  return {
    ...data,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    documents: data.documents || [],
  };
}

/**
 * Hook to fetch all projects with their tasks
 * Uses React Query for deduplication - multiple components calling this = 1 request
 */
export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: projectKeys.list(user?.id ?? ""),
    queryFn: () => fetchProjectsForUser(user!.id),
    enabled: !!user, // Only run when user is logged in
    staleTime: 30 * 1000, // Consider fresh for 30s
    refetchOnWindowFocus: true, // Refetch when returning from background
  });

  return {
    projects,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    // For optimistic updates - set projects directly in cache
    setProjects: (updater: ProjectWithRelations[] | ((prev: ProjectWithRelations[]) => ProjectWithRelations[])) => {
      queryClient.setQueryData(
        projectKeys.list(user?.id ?? ""),
        typeof updater === "function" ? updater(projects) : updater
      );
    },
  };
}

/**
 * Hook to fetch a single project with all relations
 */
export function useProject(projectId: string | null) {
  const queryClient = useQueryClient();

  const {
    data: project = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId, // Only run when projectId exists
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    project,
    setProject: (updater: ProjectWithRelations | null | ((prev: ProjectWithRelations | null) => ProjectWithRelations | null)) => {
      queryClient.setQueryData(
        projectKeys.detail(projectId ?? ""),
        typeof updater === "function" ? updater(project) : updater
      );
    },
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for project mutations (create, update, delete)
 * Automatically invalidates relevant queries after mutations
 */
export function useProjectMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      if (!user) {
        toast.error("You must be logged in to create a project");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        // Validate input
        const validated = createProjectSchema.parse(input);

        const insertData: ProjectInsert = {
          title: validated.title,
          description: validated.description ?? null,
          status: validated.status,
          color: validated.color,
          created_by: user.id,
        };

        const insertResult = await withTimeout(
          supabase.from("projects").insert(insertData).select().single().then(res => res),
          TIMEOUTS.MUTATION
        );

        if (insertResult.error) throw insertResult.error;
        const data = insertResult.data;

        const project = data as Project;

        // Also add the creator as an owner member
        await withTimeout(
          supabase.from("project_members").insert({
            project_id: project.id,
            user_id: user.id,
            role: "owner",
            invited_by: user.id,
            accepted_at: new Date().toISOString(),
          }),
          TIMEOUTS.MUTATION
        );

        // Invalidate projects list to refetch
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

        toast.success("Project created successfully");
        return project;
      } catch (err) {
        console.error("Error creating project:", err);
        toast.error("Failed to create project");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput): Promise<Project | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        // Validate input
        const validated = updateProjectSchema.parse(input);

        const updateData: ProjectUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const updateResult = await withTimeout(
          supabase
            .from("projects")
            .update(updateData)
            .eq("id", projectId)
            .select()
            .single()
            .then(res => res),
          TIMEOUTS.MUTATION
        );

        if (updateResult.error) throw updateResult.error;

        // Invalidate both the list and the specific project
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });

        toast.success("Project updated successfully");
        return updateResult.data as Project;
      } catch (err: unknown) {
        const supabaseError = err as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        console.error("Error updating project:", {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
          raw: err,
        });
        toast.error(supabaseError.message || "Failed to update project");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const deleteResult = await withTimeout(
          supabase.from("projects").delete().eq("id", projectId).then(res => res),
          TIMEOUTS.MUTATION
        );

        if (deleteResult.error) throw deleteResult.error;

        // Invalidate projects list
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

        toast.success("Project deleted successfully");
        return true;
      } catch (err) {
        console.error("Error deleting project:", err);
        toast.error("Failed to delete project");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createProject,
    updateProject,
    deleteProject,
    loading,
  };
}
