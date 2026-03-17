"use client";

/**
 * Workspace Context
 *
 * Provides the active workspace to the entire app.
 * Persists the selected workspace ID in localStorage.
 * Auto-selects the first workspace if none is saved.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRef } from "react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAuth } from "@/hooks/use-auth";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import type { Workspace } from "@/types";

const STORAGE_KEY = "active-workspace-id";

interface WorkspaceContextValue {
  /** The currently active workspace, or null if none selected / loading */
  activeWorkspace: Workspace | null;
  /** All workspaces the user belongs to */
  workspaces: Workspace[];
  /** Whether workspaces are still loading */
  loading: boolean;
  /** Switch to a different workspace by ID */
  setActiveWorkspaceId: (workspaceId: string) => void;
  /** Whether the active workspace is in intelligence mode */
  isIntelligence: boolean;
}

const SSR_DEFAULT: WorkspaceContextValue = {
  activeWorkspace: null,
  workspaces: [],
  loading: true,
  setActiveWorkspaceId: () => {},
  isIntelligence: false,
};

const WorkspaceContext = createContext<WorkspaceContextValue>(SSR_DEFAULT);

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { workspaces, loading, refetch } = useWorkspaces();
  const { user } = useAuth();
  const lazyCreating = useRef(false);

  // Initialize from localStorage
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Auto-select first workspace when workspaces load and no selection exists
  useEffect(() => {
    if (!loading && workspaces.length > 0 && !activeId) {
      const firstId = workspaces[0].id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [loading, workspaces, activeId]);

  // Lazy-create a default workspace for existing users with zero workspaces
  useEffect(() => {
    if (loading || !user || workspaces.length > 0 || lazyCreating.current) return;
    lazyCreating.current = true;

    (async () => {
      try {
        const supabase = getClient();
        const { data: workspace, error: wsError } = await supabase
          .from("workspaces")
          .insert({ name: "My Workspace", type: "standard", created_by: user.id })
          .select("id")
          .single();

        if (wsError) {
          logger.error("Error lazy-creating workspace", { userId: user.id, error: wsError });
          return;
        }

        const wsId = (workspace as { id: string }).id;
        const { error: memberError } = await supabase
          .from("workspace_members")
          .insert({
            workspace_id: wsId,
            user_id: user.id,
            role: "owner",
            invited_by: user.id,
          });

        if (memberError) {
          logger.error("Error adding user to lazy-created workspace", { error: memberError });
          return;
        }

        // Refetch workspaces so the new one appears
        refetch();
      } catch (err) {
        logger.error("Unexpected error in lazy workspace creation", { error: err });
      }
    })();
  }, [loading, user, workspaces.length, refetch]);

  // If the stored workspace ID doesn't match any workspace, reset
  useEffect(() => {
    if (
      !loading &&
      workspaces.length > 0 &&
      activeId &&
      !workspaces.find((w) => w.id === activeId)
    ) {
      const firstId = workspaces[0].id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [loading, workspaces, activeId]);

  const setActiveWorkspaceId = useCallback(
    (workspaceId: string) => {
      setActiveId(workspaceId);
      localStorage.setItem(STORAGE_KEY, workspaceId);
    },
    []
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId]
  );

  // Show intelligence features if any workspace is intelligence type
  const isIntelligence = workspaces.some((w) => w.type === "intelligence");

  const value = useMemo(
    () => ({
      activeWorkspace,
      workspaces,
      loading,
      setActiveWorkspaceId,
      isIntelligence,
    }),
    [activeWorkspace, workspaces, loading, setActiveWorkspaceId, isIntelligence]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
