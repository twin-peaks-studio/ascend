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
 * Fetch profiles of users who are members of the current user's projects
 * This is scalable - only fetches relevant profiles, not the entire user base
 */
async function fetchTeamProfiles(userId: string): Promise<Profile[]> {
  const supabase = getClient();

  // Step 1: Get all project IDs the current user has access to
  // (projects they own + projects they're a member of)
  const ownedProjectsResult = await withTimeout(
    supabase.from("projects").select("id").eq("created_by", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching owned projects timed out"
  );

  const memberProjectsResult = await withTimeout(
    supabase.from("project_members").select("project_id").eq("user_id", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching member projects timed out"
  );

  const ownedProjectIds = ownedProjectsResult.data?.map((p: { id: string }) => p.id) || [];
  const memberProjectIds = memberProjectsResult.data?.map((m: { project_id: string }) => m.project_id) || [];

  const allProjectIds = [...new Set([...ownedProjectIds, ...memberProjectIds])];

  if (allProjectIds.length === 0) {
    // User has no projects - just return their own profile
    const selfResult = await withTimeout(
      supabase.from("profiles").select("*").eq("id", userId).single(),
      TIMEOUTS.DATA_QUERY,
      "Fetching own profile timed out"
    );
    return selfResult.data ? [selfResult.data as Profile] : [];
  }

  // Step 2: Get all user IDs who are members of these projects
  const projectMembersResult = await withTimeout(
    supabase
      .from("project_members")
      .select("user_id")
      .in("project_id", allProjectIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching project members timed out"
  );

  // Also include project creators
  const projectCreatorsResult = await withTimeout(
    supabase
      .from("projects")
      .select("created_by")
      .in("id", allProjectIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching project creators timed out"
  );

  const memberUserIds = projectMembersResult.data?.map((m: { user_id: string }) => m.user_id) || [];
  const creatorUserIds = projectCreatorsResult.data?.map((p: { created_by: string }) => p.created_by) || [];

  // Combine and dedupe, always include current user
  const allUserIds = [...new Set([userId, ...memberUserIds, ...creatorUserIds])];

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
      projectCount: allProjectIds.length,
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
 * Hook to fetch profiles of team members (users in your projects)
 *
 * This is scalable - only fetches profiles of users who are members
 * of projects you have access to, not the entire user database.
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
      console.log("🟢 Profile update successful:", updatedProfile);
      console.log("🟢 Updating cache with key:", profileKeys.detail(updatedProfile.id));

      // Update the detail cache
      queryClient.setQueryData(profileKeys.detail(updatedProfile.id), updatedProfile);

      // Invalidate team list to pick up changes
      queryClient.invalidateQueries({ queryKey: profileKeys.teamList(user!.id) });

      console.log("🟢 Cache updated and queries invalidated");
    },
  });
}
