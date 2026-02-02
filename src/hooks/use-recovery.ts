"use client";

/**
 * Recovery Hooks
 *
 * Consumer hooks for the App Recovery system.
 * These hooks allow components to:
 * - Get the current recovery state
 * - Subscribe to data refresh signals
 * - Request manual recovery
 */

import { useEffect, useCallback } from "react";
import {
  useRecoveryContext,
  type RecoveryStatus,
  type AuthConfidence,
} from "@/providers/app-recovery-provider";

/**
 * Recovery state returned by useRecoveryState
 */
export interface RecoveryState {
  /** Current recovery status */
  status: RecoveryStatus;
  /** Whether the connection is healthy */
  connectionHealthy: boolean;
  /** Auth confidence level */
  authConfidence: AuthConfidence;
  /** When the last recovery completed */
  lastRecoveryAt: number | null;
  /** Whether the app is currently in a degraded state */
  isDegraded: boolean;
  /** Whether recovery is in progress */
  isRecovering: boolean;
}

/**
 * Hook to get the current recovery state
 *
 * @returns The current recovery state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { status, isDegraded, isRecovering } = useRecoveryState();
 *
 *   if (isRecovering) {
 *     return <LoadingIndicator />;
 *   }
 *
 *   if (isDegraded) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <Content />;
 * }
 * ```
 */
export function useRecoveryState(): RecoveryState {
  const {
    status,
    connectionHealthy,
    authConfidence,
    lastRecoveryAt,
  } = useRecoveryContext();

  return {
    status,
    connectionHealthy,
    authConfidence,
    lastRecoveryAt,
    isDegraded: status === "degraded",
    isRecovering: status === "recovering",
  };
}

/**
 * Hook to subscribe to data refresh signals from the recovery manager.
 * When the app recovers from backgrounding, the provided callback will be called.
 *
 * @param refetchFn - Function to call when data should be refreshed
 *
 * @example
 * ```typescript
 * function MyDataComponent() {
 *   const { data, refetch } = useMyData();
 *
 *   // Automatically refetch when app recovers from background
 *   useRecoveryRefresh(refetch);
 *
 *   return <DataView data={data} />;
 * }
 * ```
 */
export function useRecoveryRefresh(refetchFn: () => void): void {
  const { subscribeToRefresh, status } = useRecoveryContext();

  useEffect(() => {
    // Subscribe to refresh signals
    const unsubscribe = subscribeToRefresh(refetchFn);

    return unsubscribe;
  }, [subscribeToRefresh, refetchFn]);
}

/**
 * Hook to get a function that can manually request recovery.
 * Useful when a mutation fails and you want to trigger a recovery attempt.
 *
 * @returns Function to request recovery
 *
 * @example
 * ```typescript
 * function MyMutationComponent() {
 *   const requestRecovery = useRequestRecovery();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveMutation();
 *     } catch (error) {
 *       if (isNetworkError(error)) {
 *         requestRecovery();
 *       }
 *     }
 *   };
 *
 *   return <SaveButton onClick={handleSave} />;
 * }
 * ```
 */
export function useRequestRecovery(): () => void {
  const { requestRecovery } = useRecoveryContext();
  return requestRecovery;
}

/**
 * Hook that returns whether the app should show loading states.
 * Returns false during recovery to keep showing cached data.
 *
 * @param isInitialLoad - Whether this is the initial data load
 * @returns Whether to show loading state
 *
 * @example
 * ```typescript
 * function MyDataComponent() {
 *   const { data, loading: dataLoading } = useMyData();
 *   const [isInitialLoad, setIsInitialLoad] = useState(true);
 *   const showLoading = useShouldShowLoading(isInitialLoad);
 *
 *   useEffect(() => {
 *     if (data) setIsInitialLoad(false);
 *   }, [data]);
 *
 *   // Show skeleton only on initial load, not during recovery
 *   if (dataLoading && showLoading) {
 *     return <Skeleton />;
 *   }
 *
 *   return <DataView data={data} />;
 * }
 * ```
 */
export function useShouldShowLoading(isInitialLoad: boolean): boolean {
  const { status } = useRecoveryContext();

  // Show loading on initial load
  if (isInitialLoad) {
    return true;
  }

  // Don't show loading during recovery - keep cached data visible
  if (status === "recovering") {
    return false;
  }

  return true;
}

/**
 * Hook that provides a stable callback that won't trigger during recovery.
 * Useful for expensive operations that shouldn't run during recovery.
 *
 * @param callback - The callback to potentially defer
 * @returns A wrapped callback that respects recovery state
 */
export function useRecoveryAwareCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const { status } = useRecoveryContext();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (status === "recovering") {
        console.log("[Recovery] Deferring callback during recovery");
        return;
      }
      return callback(...args);
    }) as T,
    [callback, status]
  );
}
