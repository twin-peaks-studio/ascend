"use client";

/**
 * Project Data Hooks
 *
 * Custom hooks for fetching and mutating project data.
 * Uses Supabase for data persistence with optimistic updates.
 * Projects are filtered by user access (owner or member).
 */

import { useCallback, useEffect, useState } from "react";
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

/**
 * Hook to fetch all projects with their tasks
 * Only fetches projects the user has access to (owner or member)
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First get project IDs where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);

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

      const { data, error: fetchError } = await query.order("created_at", { ascending: false });

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
      setError(err instanceof Error ? err : new Error("Failed to fetch projects"));
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const supabase = createClient();

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select(
          `
          *,
          tasks:tasks(*),
          documents:project_documents(*)
        `
        )
        .eq("id", projectId)
        .single();

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
      setError(err instanceof Error ? err : new Error("Failed to fetch project"));
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

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
