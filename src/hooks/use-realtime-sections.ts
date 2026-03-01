import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { sectionKeys } from "@/hooks/use-sections";
import type { Section } from "@/types";

/**
 * Subscribe to real-time section updates for a specific project
 *
 * This hook subscribes to Supabase Realtime and updates the React Query cache
 * when sections are created, updated, or deleted by other users.
 */
export function useRealtimeSections(projectId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    const channel = supabase
      .channel(`project:${projectId}:sections`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sections",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newSection = payload.new as Section | null;
          const oldSection = payload.old as { id?: string } | null;

          logger.debug("Real-time section update received", {
            event: payload.eventType,
            sectionId: newSection?.id || oldSection?.id,
            projectId,
          });

          queryClient.setQueryData<Section[]>(
            sectionKeys.list(projectId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  // Invalidate to refetch (need full data with server-generated fields)
                  queryClient.invalidateQueries({
                    queryKey: sectionKeys.list(projectId),
                  });
                  return oldData;
                }

                case "UPDATE": {
                  const updated = payload.new as Section;
                  return oldData.map((s) =>
                    s.id === updated.id ? { ...s, ...updated } : s
                  );
                }

                case "DELETE": {
                  const deletedId = payload.old?.id;
                  return oldData.filter((s) => s.id !== deletedId);
                }

                default:
                  return oldData;
              }
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Subscribed to real-time section updates", { projectId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time section updates", {
            projectId,
          });
        }
      });

    return () => {
      logger.debug("Unsubscribing from real-time section updates", {
        projectId,
      });
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
