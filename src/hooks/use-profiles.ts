"use client";

/**
 * Profile Data Hooks
 *
 * Custom hooks for fetching user profile data.
 * Uses React Query for request deduplication and caching.
 *
 * IMPORTANT: useProfiles() now only fetches profiles for users who are
 * members of projects the current user has access to. This scales properly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/types";

// Query keys for cache management
export const profileKeys = {
  all: ["profiles"] as const,
  lists: () => [...profileKeys.all, "list"] as const,
  // Team profiles are scoped to the current user's accessible projects
  teamList: (userId: string) => [...profileKeys.lists(), "team", userId] as const,
  details: () => [...profileKeys.all, "detail"] as const,
  detail: (id: string) => [...profileKeys.details(), id] as const,
};

/**
 * Fetch profiles of users who are members of the current user's workspaces
 * This is scalable - only fetches relevant profiles, not the entire user base
 */
async function fetchTeamProfiles(userId: string): Promise<Profile[]> {
  const supabase = getClient();

  // Step 1: Get all workspace IDs the current user is a member of
  const wsMembershipsResult = await withTimeout(
    supabase.from("workspace_members").select("workspace_id").eq("user_id", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace memberships timed out"
  );

  const workspaceIds = wsMembershipsResult.data?.map((m: { workspace_id: string }) => m.workspace_id) || [];

  if (workspaceIds.length === 0) {
    // User has no workspaces - just return their own profile
    const selfResult = await withTimeout(
      supabase.from("profiles").select("*").eq("id", userId).single(),
      TIMEOUTS.DATA_QUERY,
      "Fetching own profile timed out"
    );
    return selfResult.data ? [selfResult.data as Profile] : [];
  }

  // Step 2: Get all user IDs who are members of these workspaces
  const wsMembersResult = await withTimeout(
    supabase
      .from("workspace_members")
      .select("user_id")
      .in("workspace_id", workspaceIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace members timed out"
  );

  const memberUserIds = wsMembersResult.data?.map((m: { user_id: string }) => m.user_id) || [];

  // Combine and dedupe, always include current user
  const allUserIds = [...new Set([userId, ...memberUserIds])];

  // Step 3: Fetch profiles for these users only
  const profilesResult = await withTimeout(
    supabase
      .from("profiles")
      .select("*")
      .in("id", allUserIds)
      .order("display_name", { ascending: true, nullsFirst: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching team profiles timed out"
  );

  if (profilesResult.error) {
    logger.error("Error fetching team profiles", {
      userId,
      userIdCount: allUserIds.length,
      workspaceCount: workspaceIds.length,
      error: profilesResult.error
    });
    throw profilesResult.error;
  }

  return (profilesResult.data as Profile[]) || [];
}

/**
 * Fetch a single profile by ID
 */
async function fetchProfileById(profileId: string): Promise<Profile> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching profile timed out"
  );

  if (result.error) throw result.error;
  return result.data as Profile;
}

/**
 * Hook to fetch profiles of team members (users in your workspaces)
 *
 * This is scalable - only fetches profiles of users who are members
 * of workspaces you belong to, not the entire user database.
 */
export function useProfiles() {
  const { user } = useAuth();

  const {
    data: profiles = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: profileKeys.teamList(user?.id ?? ""),
    queryFn: () => fetchTeamProfiles(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Profiles rarely change - cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch profiles on every focus
  });

  return {
    profiles,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}

/**
 * Hook to get a single profile by ID
 */
export function useProfile(profileId: string | null) {
  const {
    data: profile = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: profileKeys.detail(profileId ?? ""),
    queryFn: () => fetchProfileById(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    profile,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}

/**
 * Hook to update the current user's profile
 */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { display_name?: string; avatar_url?: string | null }) => {
      if (!user) throw new Error("Not authenticated");

      const supabase = getClient();
      const result = await withTimeout(
        supabase
          .from("profiles")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single(),
        TIMEOUTS.MUTATION,
        "Profile update timed out"
      );

      if (result.error) {
        logger.error("Profile update error", {
          userId: user.id,
          error: result.error,
        });
        throw result.error;
      }

      return result.data as Profile;
    },
    onSuccess: (updatedProfile) => {
      // Update the detail cache
      queryClient.setQueryData(profileKeys.detail(updatedProfile.id), updatedProfile);

      // Invalidate team list to pick up changes
      queryClient.invalidateQueries({ queryKey: profileKeys.teamList(user!.id) });
    },
  });
}
