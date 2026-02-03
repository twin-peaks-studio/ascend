"use client";

/**
 * Recovery Hooks
 *
 * Simple hooks for accessing recovery state.
 * Data refetching is handled by React Query's refetchOnWindowFocus.
 * These hooks are primarily used to:
 * 1. Check if a refresh is in progress (to prevent login modal flash)
 * 2. Access auth confidence level
 */

import { useRecoveryContext } from "@/providers/app-recovery-provider";

/**
 * Get the current recovery state
 *
 * Used by app-shell.tsx to prevent showing login modal during refresh.
 */
export function useRecoveryState() {
  const context = useRecoveryContext();
  return {
    status: context.status,
    isRefreshing: context.isRefreshing,
    lastRefreshAt: context.lastRefreshAt,
    authConfidence: context.authConfidence,
  };
}

/**
 * Get a function to manually request a data refresh
 */
export function useRequestRefresh() {
  const { requestRefresh } = useRecoveryContext();
  return requestRefresh;
}
