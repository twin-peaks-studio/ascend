"use client";

/**
 * Project Data Hooks
 *
 * Custom hooks for fetching and mutating project data.
 * Uses Supabase for data persistence with optimistic updates.
 * Projects are filtered by user access (owner or member).
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
import type { Project, ProjectWithRelations } from "@/types";
import type { ProjectInsert, ProjectUpdate } from "@/types/database";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation";
import { toast } from "sonner";

/**
 * Hook to fetch all projects with their tasks
 * Only fetches projects the user has access to (owner or member)
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { isRecovering } = useRecoveryState();

  // Track if this is the initial load (for showing skeletons)
  const isInitialLoad = useRef(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    // Don't clear data during recovery - keep cached visible
    if (isRecovering) {
      console.log("[useProjects] Skipping fetch during recovery, keeping cached data");
      return;
    }

    try {
      // Only show loading on initial load, not on refetch
      if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);

      const supabase = getClient();

      // First get project IDs where user is a member
      const memberResult = await withTimeout(
        supabase.from("project_members").select("project_id").eq("user_id", user.id).then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching member projects timed out"
      );
      const memberProjects = memberResult.data;
      const memberError = memberResult.error;

      if (memberError) {
        console.error("Error fetching member projects:", memberError);
      }

      const memberProjectIds = memberProjects?.map((m: { project_id: string }) => m.project_id) || [];

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
          `created_by.eq.${user.id},id.in.(${memberProjectIds.join(",")})`
        );
      } else {
        query = query.eq("created_by", user.id);
      }

      const projectsResult = await withTimeout(
        query.order("created_at", { ascending: false }).then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching projects timed out"
      );
      const data = projectsResult.data;
      const fetchError = projectsResult.error;

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
      isInitialLoad.current = false;
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("[useProjects] Fetch timed out, keeping cached data");
        // On timeout, keep cached data visible
        if (projects.length > 0) {
          return;
        }
      }
      console.error("Error fetching projects:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch projects"));
    } finally {
      setLoading(false);
    }
  }, [user, isRecovering, projects.length]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Subscribe to recovery refresh signals
  useRecoveryRefresh(fetchProjects);

  return {
    projects,
    loading: loading && isInitialLoad.current, // Only show loading on initial
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
  const { isRecovering } = useRecoveryState();

  // Track if this is the initial load
  const isInitialLoad = useRef(true);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    // Don't clear data during recovery
    if (isRecovering) {
      console.log("[useProject] Skipping fetch during recovery, keeping cached data");
      return;
    }

    try {
      if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);

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
          .single()
          .then(res => res),
        TIMEOUTS.DATA_QUERY,
        "Fetching project timed out"
      );
      const data = projectResult.data;
      const fetchError = projectResult.error;

      if (fetchError) throw fetchError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedData = data as any;
      const transformedData: ProjectWithRelations = {
        ...typedData,
        tasks: Array.isArray(typedData.tasks) ? typedData.tasks : [],
        documents: typedData.documents || [],
      };

      setProject(transformedData);
      isInitialLoad.current = false;
    } catch (err) {
      if (isTimeoutError(err)) {
        console.warn("[useProject] Fetch timed out, keeping cached data");
        if (project) {
          return;
        }
      }
      console.error("Error fetching project:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch project"));
    } finally {
      setLoading(false);
    }
  }, [projectId, isRecovering, project]);

  // Initial fetch
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Subscribe to recovery refresh signals
  useRecoveryRefresh(fetchProject);

  return {
    project,
    setProject,
    loading: loading && isInitialLoad.current,
    error,
    refetch: fetchProject,
  };
}

/**
 * Hook for project mutations (create, update, delete)
 * Includes mutation queueing for degraded/recovering states
 */
export function useProjectMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { status: recoveryStatus } = useRecoveryState();

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      if (!user) {
        toast.error("You must be logged in to create a project");
        return null;
      }

      const supabase = getClient();

      const doCreate = async (): Promise<Project> => {
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

        return project;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doCreate, {
          description: "Create project",
          onSuccess: () => toast.success("Project created successfully"),
          onError: () => toast.error("Failed to create project"),
        });
        toast.info("Project will be created when connection restores");
        return null;
      }

      try {
        setLoading(true);
        const result = await doCreate();
        toast.success("Project created successfully");
        return result;
      } catch (err) {
        console.error("Error creating project:", err);
        toast.error("Failed to create project");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, recoveryStatus]
  );

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput): Promise<Project | null> => {
      const supabase = getClient();

      const doUpdate = async (): Promise<Project> => {
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
        return updateResult.data as Project;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doUpdate, {
          description: "Update project",
          onSuccess: () => toast.success("Project updated successfully"),
          onError: () => toast.error("Failed to update project"),
        });
        toast.info("Change queued, will save when connection restores");
        return null;
      }

      try {
        setLoading(true);
        const result = await doUpdate();
        toast.success("Project updated successfully");
        return result;
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
    [recoveryStatus]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const supabase = getClient();

      const doDelete = async (): Promise<boolean> => {
        const deleteResult = await withTimeout(
          supabase.from("projects").delete().eq("id", projectId).then(res => res),
          TIMEOUTS.MUTATION
        );

        if (deleteResult.error) throw deleteResult.error;
        return true;
      };

      // Queue if in degraded/recovering state
      if (shouldQueueMutation(recoveryStatus)) {
        mutationQueue.enqueue(doDelete, {
          description: "Delete project",
          onSuccess: () => toast.success("Project deleted successfully"),
          onError: () => toast.error("Failed to delete project"),
        });
        toast.info("Project will be deleted when connection restores");
        return true;
      }

      try {
        setLoading(true);
        await doDelete();
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
    [recoveryStatus]
  );

  return {
    createProject,
    updateProject,
    deleteProject,
    loading,
  };
}
