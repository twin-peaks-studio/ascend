"use client";

/**
 * Project Data Hooks
 *
 * Custom hooks for fetching and mutating project data.
 * Uses Supabase for data persistence with optimistic updates.
 * Projects are filtered by user access (owner or member).
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { withTimeout } from "@/lib/utils";

/**
 * Hook to fetch all projects with their tasks
 * Only fetches projects the user has access to (owner or member)
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const isFetching = useRef(false);

  const supabase = createClient();

  const fetchProjects = useCallback(async (isBackgroundRefresh = false) => {
    if (!user) {
      setProjects([]);
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

      // First get project IDs where user is a member (with timeout)
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

      // Build the query - fetch projects where user is creator OR is a member
      let query = supabase
        .from("projects")
        .select(
          `
          *,
          tasks:tasks(*),
          documents:project_documents(*)
        `
        );

      // Build OR filter based on what IDs we have
      if (memberProjectIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${memberProjectIds.join(",")})`);
      } else {
        query = query.eq("created_by", user.id);
      }

      // Wrap the main query with timeout
      const { data, error: fetchError } = await withTimeout(
        query.order("created_at", { ascending: false })
      );

      if (fetchError) {
        console.error("Supabase error details:", fetchError);
        throw fetchError;
      }

      // Transform data to match our types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedData: ProjectWithRelations[] = ((data || []) as any[]).map(
        (project) => ({
          ...project,
          tasks: Array.isArray(project.tasks) ? project.tasks : [],
          documents: project.documents || [],
        })
      );

      setProjects(transformedData);
    } catch (err) {
      console.error("Error fetching projects:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch projects";
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
    fetchProjects();
  }, [fetchProjects]);

  // Refetch when app becomes visible again (handles mobile backgrounding)
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && user) {
        // Wait a moment for network to restore after backgrounding
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Reset fetching flag to allow refetch
        isFetching.current = false;

        // Background refresh - don't show loading state
        await fetchProjects(true);

        // If we got an error (likely timeout), retry once after a delay
        if (error) {
          retryTimeout = setTimeout(() => {
            isFetching.current = false;
            fetchProjects(true);
          }, 1000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [fetchProjects, user, error]);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
  };
}

/**
 * Hook to fetch a single project with all relations
 */
export function useProject(projectId: string | null) {
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isFetching = useRef(false);

  const supabase = createClient();

  const fetchProject = useCallback(async (isBackgroundRefresh = false) => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await withTimeout(
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
          .single()
      );

      if (fetchError) throw fetchError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedData = data as any;
      const transformedData: ProjectWithRelations = {
        ...typedData,
        tasks: Array.isArray(typedData.tasks) ? typedData.tasks : [],
        documents: typedData.documents || [],
      };

      setProject(transformedData);
    } catch (err) {
      console.error("Error fetching project:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch project";
      setError(err instanceof Error ? err : new Error(errorMessage));

      if (errorMessage.includes("timed out")) {
        toast.error("Connection timed out. Please refresh the page.");
      }
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [projectId, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Refetch when app becomes visible again
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && projectId) {
        // Wait a moment for network to restore after backgrounding
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Reset fetching flag to allow refetch
        isFetching.current = false;

        // Background refresh
        await fetchProject(true);

        // If we got an error, retry once after a delay
        if (error) {
          retryTimeout = setTimeout(() => {
            isFetching.current = false;
            fetchProject(true);
          }, 1000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [fetchProject, projectId, error]);

  return {
    project,
    setProject,
    loading,
    error,
    refetch: fetchProject,
  };
}

/**
 * Hook for project mutations (create, update, delete)
 */
export function useProjectMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      if (!user) {
        toast.error("You must be logged in to create a project");
        return null;
      }

      try {
        setLoading(true);

        // Validate input
        const validated = createProjectSchema.parse(input);

        const insertData: ProjectInsert = {
          title: validated.title,
          description: validated.description ?? null,
          status: validated.status,
          color: validated.color,
          created_by: user.id,
        };

        const { data, error } = await supabase
          .from("projects")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        const project = data as Project;

        // Also add the creator as an owner member
        await supabase.from("project_members").insert({
          project_id: project.id,
          user_id: user.id,
          role: "owner",
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
        });

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
    [supabase, user]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      input: UpdateProjectInput
    ): Promise<Project | null> => {
      try {
        setLoading(true);

        // Validate input
        const validated = updateProjectSchema.parse(input);

        const updateData: ProjectUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          .update(updateData)
          .eq("id", projectId)
          .select()
          .single();

        if (error) throw error;

        toast.success("Project updated successfully");
        return data as Project;
      } catch (err: unknown) {
        // Log full error details for debugging
        const supabaseError = err as { message?: string; code?: string; details?: string; hint?: string };
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
    [supabase]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("projects")
          .delete()
          .eq("id", projectId);

        if (error) throw error;

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
    [supabase]
  );

  return {
    createProject,
    updateProject,
    deleteProject,
    loading,
  };
}
