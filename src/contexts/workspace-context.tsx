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
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaces } from "@/hooks/use-workspaces";
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
  const { workspaces, loading } = useWorkspaces();
  const queryClient = useQueryClient();

  // Initialize from localStorage
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Auto-select first workspace when workspaces load and no selection exists
  useEffect(() => {
    if (!loading && workspaces.length > 0 && !activeId) {
      const firstId = workspaces[0].id;
      setActiveId(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [loading, workspaces, activeId]);

  // If the stored workspace ID doesn't match any workspace, reset
  useEffect(() => {
    if (
      !loading &&
      workspaces.length > 0 &&
      activeId &&
      !workspaces.find((w) => w.id === activeId)
    ) {
      const firstId = workspaces[0].id;
      setActiveId(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [loading, workspaces, activeId]);

  const setActiveWorkspaceId = useCallback(
    (workspaceId: string) => {
      setActiveId(workspaceId);
      localStorage.setItem(STORAGE_KEY, workspaceId);

      // Clear all query caches when switching workspaces
      // so data is refetched for the new workspace context
      queryClient.clear();
    },
    [queryClient]
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId]
  );

  const isIntelligence = activeWorkspace?.type === "intelligence";

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
