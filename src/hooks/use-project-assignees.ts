"use client";

/**
 * Project Assignees Hook
 *
 * Returns the list of profiles that can be assigned to tasks in a project.
 * - If no project is selected and no workspaceId given, returns only the current user
 * - If a project is selected, returns all workspace members (via project's workspace_id)
 * - If workspaceId is given directly, returns all workspace members
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/types/database";

/**
 * Hook to get assignable profiles for a project (via workspace membership)
 * @param projectId - The project ID, or null for no project
 * @param allProfiles - All profiles from useProfiles() for fallback
 * @param workspaceId - Optional workspace ID (used when projectId is null)
 * @returns Filtered list of profiles that can be assigned
 */
export function useProjectAssignees(projectId: string | null, allProfiles: Profile[], workspaceId?: string | null) {
  const { user } = useAuth();
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!projectId && !workspaceId) {
      setMemberIds(new Set());
      return;
    }

    try {
      setLoading(true);

      let wsId = workspaceId;

      // If we have a projectId but no workspaceId, look it up from the project
      if (projectId && !wsId) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("workspace_id")
          .eq("id", projectId)
          .single();

        if (projectError || !project?.workspace_id) {
          logger.error("Error fetching project workspace_id", {
            projectId,
            error: projectError
          });
          setMemberIds(new Set());
          return;
        }
        wsId = project.workspace_id;
      }

      if (!wsId) {
        setMemberIds(new Set());
        return;
      }

      // Fetch all workspace member user IDs
      const { data, error } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", wsId);

      if (error) {
        logger.error("Error fetching workspace members for assignees", {
          workspaceId: wsId,
          projectId,
          error
        });
        setMemberIds(new Set());
        return;
      }

      const ids = new Set<string>(data?.map((m) => m.user_id) || []);
      setMemberIds(ids);
    } finally {
      setLoading(false);
    }
  }, [supabase, projectId, workspaceId]);

  useEffect(() => {
    fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  // Compute assignable profiles
  const assignableProfiles = useMemo(() => {
    if (!user) return [];

    // If no project selected, only the current user can be assigned
    if (!projectId) {
      const currentUserProfile = allProfiles.find((p) => p.id === user.id);
      return currentUserProfile ? [currentUserProfile] : [];
    }

    // If project selected, return current user + all workspace members
    // Filter profiles to only include workspace members
    const filteredProfiles = allProfiles.filter(
      (p) => p.id === user.id || memberIds.has(p.id)
    );

    // Sort by display name, but put current user first
    return filteredProfiles.sort((a, b) => {
      if (a.id === user.id) return -1;
      if (b.id === user.id) return 1;
      const nameA = a.display_name || a.email || "";
      const nameB = b.display_name || b.email || "";
      return nameA.localeCompare(nameB);
    });
  }, [user, projectId, allProfiles, memberIds]);

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
    if (!user || (!projectId && !workspaceId)) return false;
    return memberIds.size > 1 || (memberIds.size === 1 && !memberIds.has(user.id));
  }, [user, projectId, workspaceId, memberIds]);

  return {
    assignableProfiles,
    loading,
    canAssign,
    hasSharedMembers,
    refetch: fetchWorkspaceMembers,
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
