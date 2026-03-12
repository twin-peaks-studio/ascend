"use client";

/**
 * Workspace Members Hook
 *
 * Handles fetching and managing workspace members.
 * Follows the same pattern as use-project-members.ts.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { WorkspaceMember, Profile } from "@/types/database";
import { toast } from "sonner";

export interface WorkspaceMemberWithProfile extends WorkspaceMember {
  profile: Profile | null;
}

// Query keys for cache management
export const workspaceMemberKeys = {
  all: ["workspaceMembers"] as const,
  lists: () => [...workspaceMemberKeys.all, "list"] as const,
  list: (workspaceId: string) =>
    [...workspaceMemberKeys.lists(), workspaceId] as const,
};

/**
 * Fetch workspace members with their profiles
 */
async function fetchWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithProfile[]> {
  const supabase = getClient();

  const membersResult = await withTimeout(
    supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace members timed out"
  );

  if (membersResult.error) throw membersResult.error;

  const membersData = membersResult.data as WorkspaceMember[] | null;
  if (!membersData || membersData.length === 0) return [];

  // Get unique user IDs
  const userIds = [...new Set(membersData.map((m) => m.user_id))];

  const profilesResult = await withTimeout(
    supabase.from("profiles").select("*").in("id", userIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching member profiles timed out"
  );

  if (profilesResult.error) throw profilesResult.error;

  const profileMap = new Map<string, Profile>();
  (profilesResult.data as Profile[] | null)?.forEach((p) =>
    profileMap.set(p.id, p)
  );

  return membersData.map((member) => ({
    ...member,
    profile: profileMap.get(member.user_id) || null,
  }));
}

/**
 * Hook to fetch workspace members
 */
export function useWorkspaceMembers(workspaceId: string | null) {
  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: workspaceMemberKeys.list(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    members,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for workspace member mutations (invite, remove)
 */
export function useWorkspaceMemberMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const inviteByEmail = useCallback(
    async (
      workspaceId: string,
      email: string,
      role: "admin" | "member" = "member"
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "You must be logged in" };
      }

      try {
        setLoading(true);
        const supabase = getClient();

        const normalizedEmail = email.toLowerCase().trim();

        // Find user by email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .eq("email", normalizedEmail)
          .single();

        if (profileError || !profile) {
          return {
            success: false,
            error:
              "No user found with that email. They must create an account first.",
          };
        }

        // Check if already a member
        const { data: existing } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", profile.id)
          .single();

        if (existing) {
          return {
            success: false,
            error: "This user is already a member of this workspace.",
          };
        }

        // Add as member
        const { error: insertError } = await supabase
          .from("workspace_members")
          .insert({
            workspace_id: workspaceId,
            user_id: profile.id,
            role,
            invited_by: user.id,
          });

        if (insertError) throw insertError;

        queryClient.invalidateQueries({
          queryKey: workspaceMemberKeys.list(workspaceId),
        });

        toast.success(
          `${profile.display_name || profile.email} added to workspace`
        );
        return { success: true };
      } catch (err) {
        logger.error("Error inviting workspace member", {
          workspaceId,
          email,
          error: err,
        });
        return { success: false, error: "Failed to invite user." };
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const removeMember = useCallback(
    async (
      workspaceId: string,
      memberId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "You must be logged in" };
      }

      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase
          .from("workspace_members")
          .delete()
          .eq("id", memberId);

        if (error) throw error;

        queryClient.invalidateQueries({
          queryKey: workspaceMemberKeys.list(workspaceId),
        });

        toast.success("Member removed from workspace");
        return { success: true };
      } catch (err) {
        logger.error("Error removing workspace member", {
          workspaceId,
          memberId,
          error: err,
        });
        return { success: false, error: "Failed to remove member." };
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  return {
    inviteByEmail,
    removeMember,
    loading,
  };
}
