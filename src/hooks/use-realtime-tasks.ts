import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { taskKeys } from "@/hooks/use-tasks";
import type { Task, TaskWithProject } from "@/types";

/**
 * Subscribe to real-time task updates for a specific project
 *
 * This hook subscribes to Supabase Realtime and updates the React Query cache
 * when tasks are created, updated, or deleted by other users.
 *
 * @param projectId - Project ID to subscribe to, or null to disable subscription
 * @param userId - Current user ID for cache updates
 */
export function useRealtimeTasksForProject(
  projectId: string | null,
  userId: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId || !userId) return;

    const supabase = getClient();

    // Subscribe to task changes for this project
    const channel = supabase
      .channel(`project:${projectId}:tasks`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newTask = payload.new as Task | null;
          const oldTask = payload.old as Task | null;

          logger.debug("Real-time task update received", {
            event: payload.eventType,
            taskId: newTask?.id || oldTask?.id,
            projectId,
          });

          // Update the task list cache
          queryClient.setQueryData<TaskWithProject[]>(
            taskKeys.list(userId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  const newTask = payload.new as Task;
                  // Check if task already exists (from optimistic update)
                  const exists = oldData.some((t) => t.id === newTask.id);
                  if (exists) {
                    // Replace optimistic task with server version
                    return oldData.map((t) =>
                      t.id === newTask.id ? { ...newTask, project: t.project } : t
                    );
                  }
                  // Add new task (need to fetch project separately or from cache)
                  // For now, we'll let the query refetch naturally
                  return oldData;
                }

                case "UPDATE": {
                  const updatedTask = payload.new as Task;
                  return oldData.map((task) =>
                    task.id === updatedTask.id
                      ? { ...task, ...updatedTask }
                      : task
                  );
                }

                case "DELETE": {
                  const deletedTaskId = payload.old?.id;
                  return oldData.filter((task) => task.id !== deletedTaskId);
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
          logger.info("Subscribed to real-time task updates", { projectId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time task updates", {
            projectId,
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      logger.debug("Unsubscribing from real-time task updates", { projectId });
      supabase.removeChannel(channel);
    };
  }, [projectId, userId, queryClient]);
}

/**
 * Subscribe to real-time task updates for all user's tasks
 *
 * This subscribes to all task changes. RLS policies ensure the user only
 * receives updates for tasks they have access to.
 *
 * @param userId - Current user ID
 */
export function useRealtimeTasksGlobal(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = getClient();

    // Subscribe to all task changes (RLS will filter to accessible tasks)
    const channel = supabase
      .channel(`user:${userId}:tasks`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          const newTask = payload.new as Task | null;
          const oldTask = payload.old as Task | null;

          logger.debug("Real-time task update received (global)", {
            event: payload.eventType,
            taskId: newTask?.id || oldTask?.id,
          });

          // Update the task list cache
          queryClient.setQueryData<TaskWithProject[]>(
            taskKeys.list(userId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  // For inserts, we need to refetch to get the project data
                  // Invalidate the query to trigger a refetch
                  queryClient.invalidateQueries({
                    queryKey: taskKeys.list(userId),
                  });
                  return oldData;
                }

                case "UPDATE": {
                  const updatedTask = payload.new as Task;
                  return oldData.map((task) =>
                    task.id === updatedTask.id
                      ? { ...task, ...updatedTask }
                      : task
                  );
                }

                case "DELETE": {
                  const deletedTaskId = payload.old?.id;
                  return oldData.filter((task) => task.id !== deletedTaskId);
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
          logger.info("Subscribed to global real-time task updates", {
            userId,
          });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to global real-time task updates", {
            userId,
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      logger.debug("Unsubscribing from global real-time task updates", {
        userId,
      });
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
