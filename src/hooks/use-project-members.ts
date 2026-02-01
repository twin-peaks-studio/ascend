"use client";

/**
 * Project Members Hook
 *
 * Handles fetching and managing project members and invitations.
 * Allows users to invite other existing users to join their projects.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ProjectMember, Profile } from "@/types/database";
import { toast } from "sonner";

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Profile | null;
  inviter: Profile | null;
}

/**
 * Hook to fetch project members
 */
export function useProjectMembers(projectId: string | null) {
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch members first
      const { data: membersData, error: membersError } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .order("invited_at", { ascending: true });

      if (membersError) throw membersError;

      const typedMembersData = membersData as ProjectMember[] | null;

      if (!typedMembersData || typedMembersData.length === 0) {
        setMembers([]);
        return;
      }

      // Get unique user IDs (members + inviters)
      const userIds = [
        ...new Set([
          ...typedMembersData.map((m) => m.user_id),
          ...typedMembersData.map((m) => m.invited_by),
        ]),
      ];

      // Fetch all profiles in one query
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const typedProfilesData = profilesData as Profile[] | null;

      // Create a map for quick profile lookup
      const profileMap = new Map<string, Profile>();
      typedProfilesData?.forEach((p) => profileMap.set(p.id, p));

      // Combine members with their profiles
      const membersWithProfiles: ProjectMemberWithProfile[] = typedMembersData.map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) || null,
        inviter: profileMap.get(member.invited_by) || null,
      }));

      setMembers(membersWithProfiles);
    } catch (err) {
      console.error("Error fetching project members:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch project members")
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    refetch: fetchMembers,
  };
}

/**
 * Hook for project member mutations (invite, remove)
 */
export function useProjectMemberMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();

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

        toast.success(`${profile.display_name || profile.email} has been added to the project`);
        return { success: true };
      } catch (err) {
        console.error("Error inviting user:", err);
        return {
          success: false,
          error: "Failed to invite user. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [supabase, user]
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

        toast.success("Member removed from project");
        return { success: true };
      } catch (err) {
        console.error("Error removing member:", err);
        return {
          success: false,
          error: "Failed to remove member. Please try again.",
        };
      } finally {
        setLoading(false);
      }
    },
    [supabase, user]
  );

  return {
    inviteByEmail,
    removeMember,
    loading,
  };
}
