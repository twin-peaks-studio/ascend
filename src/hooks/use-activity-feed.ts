"use client";

/**
 * Activity Feed Data Hook
 *
 * Fetches activity log entries for a project.
 * Uses React Query for caching and deduplication.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import type { ActivityLogWithActor } from "@/types";

export const activityKeys = {
  all: ["activity"] as const,
  lists: () => [...activityKeys.all, "list"] as const,
  projectActivity: (projectId: string) =>
    [...activityKeys.lists(), "project", projectId] as const,
};

async function fetchProjectActivity(
  projectId: string
): Promise<ActivityLogWithActor[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from("activity_log")
    .select(
      `
      *,
      actor:profiles!activity_log_actor_id_fkey(*)
    `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    logger.error("Error fetching activity feed", { projectId, error });
    throw new Error(error.message);
  }

  return data as ActivityLogWithActor[];
}

/**
 * Hook to fetch the activity feed for a project.
 * Returns the 50 most recent activities, newest first.
 */
export function useActivityFeed(projectId: string | null) {
  return useQuery({
    queryKey: projectId
      ? activityKeys.projectActivity(projectId)
      : ["activity", "list", "null"],
    queryFn: () =>
      projectId ? fetchProjectActivity(projectId) : Promise.resolve([]),
    enabled: !!projectId,
    staleTime: 30000,
  });
}
