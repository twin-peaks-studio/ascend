/**
 * Mutation Queue
 *
 * Handles queueing mutations when the app is in a degraded or recovering state.
 * Mutations are stored and automatically replayed when connection is restored.
 *
 * This enables a Todoist-like experience where users can continue editing
 * even when offline or recovering from backgrounding.
 */

import { toast } from "sonner";

/**
 * Queued mutation interface
 */
export interface QueuedMutation<T = unknown> {
  /** Unique identifier for this mutation */
  id: string;
  /** The mutation operation to execute */
  operation: () => Promise<T>;
  /** Callback on successful execution */
  onSuccess?: (result: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** When the mutation was queued */
  timestamp: number;
  /** Number of retry attempts */
  retries: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Description for user feedback */
  description?: string;
}

type MutationQueueListener = (queue: QueuedMutation[]) => void;

/**
 * Generates a unique ID for mutations
 */
function generateId(): string {
  return `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mutation Queue Class
 *
 * Manages a queue of mutations that couldn't be executed due to
 * connectivity issues or app recovery state.
 */
class MutationQueueManager {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Set<MutationQueueListener> = new Set();

  /**
   * Enqueue a mutation for later execution
   *
   * @param operation - The async operation to execute
   * @param options - Additional options
   * @returns The mutation ID
   */
  enqueue<T>(
    operation: () => Promise<T>,
    options?: {
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
      description?: string;
      maxRetries?: number;
    }
  ): string {
    const id = generateId();

    const mutation: QueuedMutation<T> = {
      id,
      operation,
      onSuccess: options?.onSuccess,
      onError: options?.onError,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      description: options?.description,
    };

    this.queue.push(mutation as QueuedMutation);
    this.notifyListeners();

    console.log(`[MutationQueue] Enqueued mutation: ${id}`, {
      description: options?.description,
      queueLength: this.queue.length,
    });

    return id;
  }

  /**
   * Remove a mutation from the queue
   *
   * @param id - The mutation ID to remove
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Process all queued mutations
   * Called after recovery completes
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[MutationQueue] Processing ${this.queue.length} queued mutations`);

    // Process mutations in order (FIFO)
    const mutationsToProcess = [...this.queue];

    for (const mutation of mutationsToProcess) {
      try {
        console.log(`[MutationQueue] Executing mutation: ${mutation.id}`);
        const result = await mutation.operation();

        // Success - remove from queue and call callback
        this.remove(mutation.id);
        mutation.onSuccess?.(result);

        console.log(`[MutationQueue] Mutation succeeded: ${mutation.id}`);
      } catch (error) {
        console.error(`[MutationQueue] Mutation failed: ${mutation.id}`, error);

        mutation.retries++;

        if (mutation.retries >= mutation.maxRetries) {
          // Max retries reached - remove and call error callback
          this.remove(mutation.id);
          mutation.onError?.(
            error instanceof Error ? error : new Error(String(error))
          );

          toast.error(
            mutation.description
              ? `Failed to save: ${mutation.description}`
              : "Failed to save changes"
          );
        } else {
          console.log(
            `[MutationQueue] Will retry mutation ${mutation.id} (attempt ${mutation.retries}/${mutation.maxRetries})`
          );
        }
      }
    }

    this.isProcessing = false;
    this.notifyListeners();

    // If there are still mutations in queue (failed ones waiting for retry),
    // log it for visibility
    if (this.queue.length > 0) {
      console.log(
        `[MutationQueue] ${this.queue.length} mutations remaining in queue`
      );
    }
  }

  /**
   * Clear all queued mutations
   * Called on logout
   */
  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    this.notifyListeners();

    if (count > 0) {
      console.log(`[MutationQueue] Cleared ${count} mutations from queue`);
    }
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if there are pending mutations
   */
  hasPendingMutations(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Check if a specific mutation is queued
   */
  isQueued(id: string): boolean {
    return this.queue.some((m) => m.id === id);
  }

  /**
   * Get all queued mutations (readonly)
   */
  getQueue(): ReadonlyArray<QueuedMutation> {
    return this.queue;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: MutationQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.queue]);
      } catch (error) {
        console.error("[MutationQueue] Listener error:", error);
      }
    });
  }
}

// Export singleton instance
export const mutationQueue = new MutationQueueManager();

/**
 * Helper to check if we should queue a mutation based on recovery status
 */
export function shouldQueueMutation(
  recoveryStatus: "idle" | "recovering" | "healthy" | "degraded"
): boolean {
  return recoveryStatus === "recovering" || recoveryStatus === "degraded";
}
