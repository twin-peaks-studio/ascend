"use client";

/**
 * Search Hook
 *
 * Custom hook for searching tasks and projects.
 * Uses fuzzy, case-insensitive matching on task titles.
 * Results are filtered by user access (owned or member projects).
 */

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { TaskWithProject, Project } from "@/types";

export interface SearchResults {
  tasks: TaskWithProject[];
  projects: Project[];
}

export function useSearch() {
  const [results, setResults] = useState<SearchResults>({ tasks: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const supabase = createClient();

  const search = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) {
        setResults({ tasks: [], projects: [] });
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get accessible project IDs (same pattern as use-tasks.ts)
        const { data: memberProjects } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id);

        const memberProjectIds = memberProjects?.map((m) => m.project_id) || [];

        const { data: ownedProjects } = await supabase
          .from("projects")
          .select("id")
          .eq("created_by", user.id);

        const ownedProjectIds = ownedProjects?.map((p) => p.id) || [];

        const accessibleProjectIds = [...new Set([...memberProjectIds, ...ownedProjectIds])];

        // Search tasks - fuzzy match on title using ilike
        const searchPattern = `%${query}%`;

        let taskQuery = supabase
          .from("tasks")
          .select(`
            *,
            project:projects(*),
            assignee:profiles(*)
          `)
          .eq("is_archived", false)
          .ilike("title", searchPattern);

        if (accessibleProjectIds.length === 0) {
          taskQuery = taskQuery.eq("created_by", user.id);
        } else {
          taskQuery = taskQuery.or(
            `project_id.in.(${accessibleProjectIds.join(",")}),created_by.eq.${user.id}`
          );
        }

        const { data: taskData, error: taskError } = await taskQuery
          .order("updated_at", { ascending: false })
          .limit(10);

        if (taskError) throw taskError;

        // Search projects - fuzzy match on title
        let projectQuery = supabase
          .from("projects")
          .select("*")
          .ilike("title", searchPattern);

        if (memberProjectIds.length > 0) {
          projectQuery = projectQuery.or(
            `created_by.eq.${user.id},id.in.(${memberProjectIds.join(",")})`
          );
        } else {
          projectQuery = projectQuery.eq("created_by", user.id);
        }

        const { data: projectData, error: projectError } = await projectQuery
          .order("updated_at", { ascending: false })
          .limit(5);

        if (projectError) throw projectError;

        setResults({
          tasks: (taskData as TaskWithProject[]) || [],
          projects: (projectData as Project[]) || [],
        });
      } catch (err) {
        console.error("Search error:", err);
        setError(err instanceof Error ? err : new Error("Search failed"));
        setResults({ tasks: [], projects: [] });
      } finally {
        setLoading(false);
      }
    },
    [supabase, user]
  );

  const clearResults = useCallback(() => {
    setResults({ tasks: [], projects: [] });
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearResults,
  };
}
