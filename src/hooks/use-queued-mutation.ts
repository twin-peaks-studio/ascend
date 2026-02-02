"use client";

/**
 * Queued Mutation Hook
 *
 * Provides a hook for executing mutations that are automatically queued
 * when the app is in a degraded or recovering state. This enables a
 * seamless offline-first experience similar to Todoist.
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  mutationQueue,
  shouldQueueMutation,
} from "@/lib/app-recovery/mutation-queue";
import { useRecoveryState } from "@/hooks/use-recovery";

/**
 * Options for queued mutation
 */
interface QueuedMutationOptions<TResult> {
  /** Callback on successful execution */
  onSuccess?: (result: TResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Description for user feedback (e.g., "Update task") */
  description?: string;
  /** Apply optimistic update before mutation completes */
  optimisticUpdate?: () => void;
  /** Rollback optimistic update on error */
  rollbackUpdate?: () => void;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Show toast when mutation is queued (default: true) */
  showQueuedToast?: boolean;
}

/**
 * Return type for useQueuedMutation
 */
interface QueuedMutationResult<TArgs extends unknown[], TResult> {
  /** Execute the mutation */
  mutate: (...args: TArgs) => Promise<TResult | "queued">;
  /** Whether the mutation is currently executing */
  isLoading: boolean;
  /** Whether the mutation was queued (not executed immediately) */
  isQueued: boolean;
  /** The queued mutation ID (if queued) */
  queuedId: string | null;
}

/**
 * Hook for executing mutations that are automatically queued during recovery/degraded states
 *
 * @param mutationFn - The mutation function to execute
 * @param options - Mutation options
 * @returns Mutation controls
 *
 * @example
 * ```typescript
 * function TaskItem({ task }) {
 *   const { mutate: updateTask, isQueued } = useQueuedMutation(
 *     async (title: string) => {
 *       return await supabase.from('tasks').update({ title }).eq('id', task.id);
 *     },
 *     {
 *       description: 'Update task',
 *       onSuccess: () => toast.success('Task updated'),
 *       optimisticUpdate: () => setLocalTitle(newTitle),
 *       rollbackUpdate: () => setLocalTitle(task.title),
 *     }
 *   );
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => updateTask(e.target.value)} />
 *       {isQueued && <span>Saving...</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useQueuedMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  options?: QueuedMutationOptions<TResult>
): QueuedMutationResult<TArgs, TResult> {
  const { status } = useRecoveryState();
  const [isLoading, setIsLoading] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  // Reset queued state when queue is processed
  useEffect(() => {
    if (!queuedId) return;

    const unsubscribe = mutationQueue.subscribe((queue) => {
      const stillQueued = queue.some((m) => m.id === queuedId);
      if (!stillQueued) {
        setIsQueued(false);
        setQueuedId(null);
      }
    });

    return unsubscribe;
  }, [queuedId]);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult | "queued"> => {
      // Apply optimistic update immediately
      options?.optimisticUpdate?.();

      // Check if we should queue the mutation
      if (shouldQueueMutation(status)) {
        const id = mutationQueue.enqueue(
          () => mutationFn(...args),
          {
            onSuccess: options?.onSuccess,
            onError: (error) => {
              options?.rollbackUpdate?.();
              options?.onError?.(error);
            },
            description: options?.description,
            maxRetries: options?.maxRetries,
          }
        );

        setIsQueued(true);
        setQueuedId(id);

        if (options?.showQueuedToast !== false) {
          toast.info(
            options?.description
              ? `${options.description} - will save when connection restores`
              : "Change queued - will save when connection restores"
          );
        }

        return "queued";
      }

      // Execute mutation immediately
      setIsLoading(true);

      try {
        const result = await mutationFn(...args);
        options?.onSuccess?.(result);
        return result;
      } catch (error) {
        options?.rollbackUpdate?.();
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options, status]
  );

  return {
    mutate,
    isLoading,
    isQueued,
    queuedId,
  };
}

/**
 * Hook to get the current mutation queue status
 *
 * @returns Queue status information
 *
 * @example
 * ```typescript
 * function AppStatus() {
 *   const { hasPending, pendingCount } = useMutationQueueStatus();
 *
 *   if (hasPending) {
 *     return <div>{pendingCount} changes pending...</div>;
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useMutationQueueStatus() {
  const [pendingCount, setPendingCount] = useState(mutationQueue.getQueueLength());

  useEffect(() => {
    const unsubscribe = mutationQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });

    return unsubscribe;
  }, []);

  return {
    hasPending: pendingCount > 0,
    pendingCount,
  };
}

/**
 * Hook to manually process the mutation queue
 * Typically called by the recovery system, but can be used manually
 *
 * @returns Function to process the queue
 */
export function useProcessMutationQueue() {
  return useCallback(() => {
    mutationQueue.processQueue();
  }, []);
}

/**
 * Hook to clear the mutation queue
 * Should be called on logout
 *
 * @returns Function to clear the queue
 */
export function useClearMutationQueue() {
  return useCallback(() => {
    mutationQueue.clear();
  }, []);
}
