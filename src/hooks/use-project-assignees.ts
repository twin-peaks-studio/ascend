"use client";

/**
 * Project Assignees Hook
 *
 * Returns the list of profiles that can be assigned to tasks in a project.
 * - If no project is selected, returns only the current user
 * - If a project is selected, returns the current user plus all project members
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/types/database";

/**
 * Hook to get assignable profiles for a project
 * @param projectId - The project ID, or null for no project
 * @param allProfiles - All profiles from useProfiles() for fallback
 * @returns Filtered list of profiles that can be assigned
 */
export function useProjectAssignees(projectId: string | null, allProfiles: Profile[]) {
  const { user } = useAuth();
  const [projectMemberIds, setProjectMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const fetchProjectMembers = useCallback(async () => {
    if (!projectId) {
      setProjectMemberIds(new Set());
      return;
    }

    try {
      setLoading(true);

      // Fetch all member user IDs for this project
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);

      if (error) {
        logger.error("Error fetching project members", {
          projectId,
          error
        });
        setProjectMemberIds(new Set());
        return;
      }

      const memberIds = new Set<string>(data?.map((m) => m.user_id) || []);
      setProjectMemberIds(memberIds);
    } finally {
      setLoading(false);
    }
  }, [supabase, projectId]);

  useEffect(() => {
    fetchProjectMembers();
  }, [fetchProjectMembers]);

  // Compute assignable profiles
  const assignableProfiles = useMemo(() => {
    if (!user) return [];

    // If no project selected, only the current user can be assigned
    if (!projectId) {
      const currentUserProfile = allProfiles.find((p) => p.id === user.id);
      return currentUserProfile ? [currentUserProfile] : [];
    }

    // If project selected, return current user + all project members
    // Filter profiles to only include project members
    const filteredProfiles = allProfiles.filter(
      (p) => p.id === user.id || projectMemberIds.has(p.id)
    );

    // Sort by display name, but put current user first
    return filteredProfiles.sort((a, b) => {
      if (a.id === user.id) return -1;
      if (b.id === user.id) return 1;
      const nameA = a.display_name || a.email || "";
      const nameB = b.display_name || b.email || "";
      return nameA.localeCompare(nameB);
    });
  }, [user, projectId, allProfiles, projectMemberIds]);

  // Check if a specific user can be assigned (useful for validation)
  const canAssign = useCallback(
    (userId: string | null): boolean => {
      if (!userId) return true; // null (unassigned) is always valid
      return assignableProfiles.some((p) => p.id === userId);
    },
    [assignableProfiles]
  );

  // Check if project has shared members (more than just the current user)
  const hasSharedMembers = useMemo(() => {
    if (!user || !projectId) return false;
    return projectMemberIds.size > 1 || (projectMemberIds.size === 1 && !projectMemberIds.has(user.id));
  }, [user, projectId, projectMemberIds]);

  return {
    assignableProfiles,
    loading,
    canAssign,
    hasSharedMembers,
    refetch: fetchProjectMembers,
  };
}

/**
 * Utility to filter profiles based on project membership
 * For use in components that already have member data
 */
export function filterAssignableProfiles(
  allProfiles: Profile[],
  currentUserId: string | undefined,
  projectMemberUserIds: string[]
): Profile[] {
  if (!currentUserId) return [];

  // Always include current user, plus any project members
  const memberSet = new Set(projectMemberUserIds);

  return allProfiles
    .filter((p) => p.id === currentUserId || memberSet.has(p.id))
    .sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      const nameA = a.display_name || a.email || "";
      const nameB = b.display_name || b.email || "";
      return nameA.localeCompare(nameB);
    });
}
