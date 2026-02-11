"use client";

/**
 * Realtime Activity Subscription Hook
 *
 * Subscribes to new activity_log inserts for a project and invalidates
 * the React Query cache so the feed stays current.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { activityKeys } from "@/hooks/use-activity-feed";

export function useRealtimeActivity(projectId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    const channel = supabase
      .channel(`project:${projectId}:activity`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: activityKeys.projectActivity(projectId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
