"use client";

/**
 * Workspace Data Hooks
 *
 * Custom hooks for fetching and mutating workspace data.
 * Uses React Query for request deduplication and caching.
 * Workspaces are containers for projects and captures.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Workspace } from "@/types";
import type { WorkspaceInsert, WorkspaceUpdate } from "@/types/database";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (userId: string) => [...workspaceKeys.lists(), userId] as const,
  details: () => [...workspaceKeys.all, "detail"] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
};

/**
 * Fetch all workspaces where user is a member
 */
async function fetchWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const supabase = getClient();

  // Get workspace IDs where user is a member
  const memberResult = await withTimeout(
    supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace memberships timed out"
  );

  if (memberResult.error) {
    logger.error("Error fetching workspace memberships", {
      userId,
      error: memberResult.error,
    });
    console.warn("[workspaces] workspace_members query failed:", memberResult.error.message, memberResult.error.code);
    // Return empty array instead of throwing — workspace tables may not
    // have proper RLS policies yet. Other features should still work.
    return [];
  }

  const workspaceIds =
    memberResult.data?.map((m: { workspace_id: string }) => m.workspace_id) ||
    [];

  console.log("[workspaces] membership query returned", memberResult.data?.length ?? 0, "rows, workspaceIds:", workspaceIds);

  if (workspaceIds.length === 0) {
    console.warn("[workspaces] No workspace memberships found for user", userId);
    return [];
  }

  const workspacesResult = await withTimeout(
    supabase
      .from("workspaces")
      .select("*")
      .in("id", workspaceIds)
      .order("created_at", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspaces timed out"
  );

  if (workspacesResult.error) {
    logger.error("Error fetching workspaces", {
      userId,
      error: workspacesResult.error,
    });
    console.warn("[workspaces] workspaces query failed:", workspacesResult.error.message, workspacesResult.error.code);
    return [];
  }

  console.log("[workspaces] fetched", workspacesResult.data?.length ?? 0, "workspaces:", (workspacesResult.data as Workspace[] | null)?.map((w) => ({ id: w.id, name: w.name })));
  return (workspacesResult.data as Workspace[]) || [];
}

/**
 * Hook to fetch all workspaces for the current user
 */
export function useWorkspaces() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: workspaces = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: workspaceKeys.list(user?.id ?? ""),
    queryFn: () => fetchWorkspacesForUser(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    workspaces,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    setWorkspaces: (
      updater: Workspace[] | ((prev: Workspace[]) => Workspace[])
    ) => {
      queryClient.setQueryData(
        workspaceKeys.list(user?.id ?? ""),
        typeof updater === "function" ? updater(workspaces) : updater
      );
    },
  };
}

/**
 * Hook for workspace mutations (create, update, delete)
 */
export function useWorkspaceMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput): Promise<Workspace | null> => {
      if (!user) {
        toast.error("You must be logged in to create a workspace");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();

        const validated = createWorkspaceSchema.parse(input);

        const insertData: WorkspaceInsert = {
          name: validated.name,
          type: validated.type,
          created_by: user.id,
        };

        const { data, error } = await withTimeout(
          supabase
            .from("workspaces")
            .insert(insertData)
            .select()
            .single()
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;
        const workspace = data as Workspace;

        // Add creator as owner member
        const { error: memberError } = await withTimeout(
          supabase.from("workspace_members").insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: "owner",
            invited_by: user.id,
          }),
          TIMEOUTS.MUTATION
        );

        if (memberError) throw memberError;

        // Invalidate workspaces list
        queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });

        toast.success("Workspace created successfully");
        return workspace;
      } catch (err) {
        logger.error("Error creating workspace", {
          userId: user.id,
          name: input.name,
          error: err,
        });
        toast.error("Failed to create workspace");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateWorkspace = useCallback(
    async (
      workspaceId: string,
      input: UpdateWorkspaceInput
    ): Promise<Workspace | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const validated = updateWorkspaceSchema.parse(input);

        const updateData: WorkspaceUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await withTimeout(
          supabase
            .from("workspaces")
            .update(updateData)
            .eq("id", workspaceId)
            .select()
            .single()
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(workspaceId),
        });

        toast.success("Workspace updated successfully");
        return data as Workspace;
      } catch (err) {
        logger.error("Error updating workspace", {
          workspaceId,
          error: err,
        });
        toast.error("Failed to update workspace");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase
            .from("workspaces")
            .delete()
            .eq("id", workspaceId)
            .then((res) => res),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });

        toast.success("Workspace deleted successfully");
        return true;
      } catch (err) {
        logger.error("Error deleting workspace", {
          workspaceId,
          error: err,
        });
        toast.error("Failed to delete workspace");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    loading,
  };
}
