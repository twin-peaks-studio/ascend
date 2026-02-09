"use client";

/**
 * Project Members Hook
 *
 * Handles fetching and managing project members and invitations.
 * Uses React Query for request deduplication and caching.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { notifyProjectInvited } from "@/lib/notifications/create-notification";
import type { ProjectMember, Profile } from "@/types/database";
import { toast } from "sonner";

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Profile | null;
  inviter: Profile | null;
}

// Query keys for cache management
export const projectMemberKeys = {
  all: ["projectMembers"] as const,
  lists: () => [...projectMemberKeys.all, "list"] as const,
  list: (projectId: string) => [...projectMemberKeys.lists(), projectId] as const,
};

/**
 * Fetch project members with their profiles
 */
async function fetchProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const supabase = getClient();

  // Fetch members first
  const membersResult = await withTimeout(
    supabase
      .from("project_members")
      .select("*")
      .eq("project_id", projectId)
      .order("invited_at", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching project members timed out"
  );

  if (membersResult.error) throw membersResult.error;

  const membersData = membersResult.data as ProjectMember[] | null;

  if (!membersData || membersData.length === 0) {
    return [];
  }

  // Get unique user IDs (members + inviters)
  const userIds = [
    ...new Set([
      ...membersData.map((m) => m.user_id),
      ...membersData.map((m) => m.invited_by),
    ]),
  ];

  // Fetch all profiles in one query
  const profilesResult = await withTimeout(
    supabase
      .from("profiles")
      .select("*")
      .in("id", userIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching member profiles timed out"
  );

  if (profilesResult.error) throw profilesResult.error;

  const profilesData = profilesResult.data as Profile[] | null;

  // Create a map for quick profile lookup
  const profileMap = new Map<string, Profile>();
  profilesData?.forEach((p) => profileMap.set(p.id, p));

  // Combine members with their profiles
  return membersData.map((member) => ({
    ...member,
    profile: profileMap.get(member.user_id) || null,
    inviter: profileMap.get(member.invited_by) || null,
  }));
}

/**
 * Hook to fetch project members
 * Uses React Query for deduplication - multiple components = 1 request
 */
export function useProjectMembers(projectId: string | null) {
  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: projectMemberKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectMembers(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000, // Members don't change often - cache for 1 minute
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
 * Hook for project member mutations (invite, remove)
 */
export function useProjectMemberMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Invite a user to a project by email
   * The user must already exist in the system
   */
  const inviteByEmail = useCallback(
    async (
      projectId: string,
      email: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "You must be logged in to invite users" };
      }

      try {
        setLoading(true);
        const supabase = getClient();

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Find the user by email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .eq("email", normalizedEmail)
          .single();

        if (profileError || !profile) {
          return {
            success: false,
            error: "No user found with that email address. They must create an account first.",
          };
        }

        // Check if user is already a member
        const { data: existingMember } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", projectId)
          .eq("user_id", profile.id)
          .single();

        if (existingMember) {
          return {
            success: false,
            error: "This user is already a member of this project.",
          };
        }

        // Check if the current user has permission to invite (must be owner or creator)
        const { data: project } = await supabase
          .from("projects")
          .select("created_by")
          .eq("id", projectId)
          .single();

        const { data: currentUserMembership } = await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .single();

        const isOwner =
          project?.created_by === user.id ||
          currentUserMembership?.role === "owner";

        if (!isOwner) {
          return {
            success: false,
            error: "Only project owners can invite new members.",
          };
        }

        // Add the user as a member
        const { error: insertError } = await supabase
          .from("project_members")
          .insert({
            project_id: projectId,
            user_id: profile.id,
            role: "member",
            invited_by: user.id,
            accepted_at: new Date().toISOString(), // Auto-accept for now
          });

        if (insertError) throw insertError;

        // Notify the invited user
        notifyProjectInvited({
          recipientId: profile.id,
          actorId: user.id,
          projectId,
        });

        // Invalidate project members cache
        queryClient.invalidateQueries({ queryKey: projectMemberKeys.list(projectId) });

        toast.success(`${profile.display_name || profile.email} has been added to the project`);
        return { success: true };
      } catch (err) {
        logger.error("Error inviting user", {
          projectId,
          email,
          invitedBy: user.id,
          error: err
        });
        return {
          success: false,
          error: "Failed to invite user. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  /**
   * Remove a member from a project
   */
  const removeMember = useCallback(
    async (
      projectId: string,
      memberId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "You must be logged in" };
      }

      try {
        setLoading(true);
        const supabase = getClient();

        // Get the member being removed
        const { data: memberToRemove } = await supabase
          .from("project_members")
          .select("user_id, role")
          .eq("id", memberId)
          .single();

        if (!memberToRemove) {
          return { success: false, error: "Member not found" };
        }

        // Check if the current user has permission
        const { data: project } = await supabase
          .from("projects")
          .select("created_by")
          .eq("id", projectId)
          .single();

        const { data: currentUserMembership } = await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .single();

        const isOwner =
          project?.created_by === user.id ||
          currentUserMembership?.role === "owner";

        // Users can remove themselves, or owners can remove others
        const canRemove =
          memberToRemove.user_id === user.id || isOwner;

        if (!canRemove) {
          return {
            success: false,
            error: "You don't have permission to remove this member.",
          };
        }

        // Prevent removing the project creator
        if (memberToRemove.user_id === project?.created_by) {
          return {
            success: false,
            error: "The project creator cannot be removed.",
          };
        }

        const { error: deleteError } = await supabase
          .from("project_members")
          .delete()
          .eq("id", memberId);

        if (deleteError) throw deleteError;

        // Invalidate project members cache
        queryClient.invalidateQueries({ queryKey: projectMemberKeys.list(projectId) });

        toast.success("Member removed from project");
        return { success: true };
      } catch (err) {
        logger.error("Error removing member", {
          projectId,
          memberId,
          removedBy: user.id,
          error: err
        });
        return {
          success: false,
          error: "Failed to remove member. Please try again.",
        };
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
