"use client";

/**
 * App Recovery Provider
 *
 * Manages auth state refresh and prevents false login modals after mobile backgrounding.
 *
 * Note: Data fetching/refetching is handled by React Query's refetchOnWindowFocus.
 * This provider only handles:
 * 1. Auth state synchronization after backgrounding
 * 2. isRefreshing state to prevent UI flicker (e.g., login modals)
 * 3. AuthConfidence tracking for the auth system
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { logger } from "@/lib/logger/logger";

/**
 * Recovery status - simplified to just two states
 */
export type RecoveryStatus = "idle" | "healthy";

/**
 * Auth confidence level - helps determine if we should show login modal
 */
export type AuthConfidence = "confirmed" | "cached" | "unknown";

/**
 * Recovery state
 */
interface RecoveryState {
  /** Current recovery status */
  status: RecoveryStatus;
  /** When the last refresh was triggered */
  lastRefreshAt: number | null;
  /** Auth confidence level */
  authConfidence: AuthConfidence;
  /** Whether currently refreshing data */
  isRefreshing: boolean;
}

/**
 * Recovery context value
 */
interface RecoveryContextValue extends RecoveryState {
  /** Manually trigger a data refresh */
  requestRefresh: () => void;
  /** Subscribe to data refresh signals */
  subscribeToRefresh: (callback: () => void) => () => void;
  /** Notify that auth has been refreshed (called by AuthProvider) */
  notifyAuthRefreshed: (confidence: AuthConfidence) => void;
  /** Request auth refresh */
  requestAuthRefresh: () => Promise<void>;
  /** Register auth refresh handler */
  registerAuthRefreshHandler: (handler: () => Promise<AuthConfidence>) => void;
}

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

/**
 * Configuration
 */
const CONFIG = {
  /** Minimum time backgrounded before triggering refresh (2 seconds) */
  MIN_BACKGROUND_FOR_REFRESH: 2_000,
  /** Debounce time for visibility changes */
  DEBOUNCE_MS: 50,
};

interface AppRecoveryProviderProps {
  children: ReactNode;
}

export function AppRecoveryProvider({ children }: AppRecoveryProviderProps) {
  const [state, setState] = useState<RecoveryState>({
    status: "healthy",
    lastRefreshAt: null,
    authConfidence: "unknown",
    isRefreshing: false,
  });

  // Track when page was hidden
  const hiddenAtRef = useRef<number | null>(null);

  // Subscribers for data refresh signals
  const refreshSubscribers = useRef<Set<() => void>>(new Set());

  // Auth refresh handler (set by AuthProvider)
  const authRefreshHandler = useRef<(() => Promise<AuthConfidence>) | null>(null);

  /**
   * Register auth refresh handler - called by AuthProvider
   */
  const registerAuthRefreshHandler = useCallback(
    (handler: () => Promise<AuthConfidence>) => {
      authRefreshHandler.current = handler;
    },
    []
  );

  /**
   * Request auth refresh
   */
  const requestAuthRefresh = useCallback(async (): Promise<void> => {
    if (authRefreshHandler.current) {
      try {
        const confidence = await authRefreshHandler.current();
        setState((prev) => ({ ...prev, authConfidence: confidence }));
      } catch (error) {
        logger.warn("Auth refresh failed", { error });
        setState((prev) => ({ ...prev, authConfidence: "cached" }));
      }
    }
  }, []);

  /**
   * Notify that auth has been refreshed
   */
  const notifyAuthRefreshed = useCallback((confidence: AuthConfidence) => {
    setState((prev) => ({ ...prev, authConfidence: confidence }));
  }, []);

  /**
   * Subscribe to data refresh signals
   */
  const subscribeToRefresh = useCallback((callback: () => void) => {
    refreshSubscribers.current.add(callback);
    return () => {
      refreshSubscribers.current.delete(callback);
    };
  }, []);

  /**
   * Emit data refresh signal to all subscribers
   */
  const emitRefreshSignal = useCallback(() => {
    logger.info("Emitting refresh signal to subscribers", {
      subscriberCount: refreshSubscribers.current.size
    });
    refreshSubscribers.current.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        logger.error("Refresh subscriber error", { error });
      }
    });
  }, []);

  /**
   * Trigger a refresh after backgrounding
   */
  const triggerRefresh = useCallback(async () => {
    logger.info("Triggering refresh after backgrounding");
    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      // Refresh auth first (Supabase may have refreshed token, we just sync state)
      await requestAuthRefresh();

      // Signal data hooks to refetch
      emitRefreshSignal();

      setState((prev) => ({
        ...prev,
        status: "healthy",
        lastRefreshAt: Date.now(),
        isRefreshing: false,
      }));
    } catch (error) {
      logger.error("Refresh failed", { error });
      setState((prev) => ({ ...prev, isRefreshing: false }));
    }
  }, [requestAuthRefresh, emitRefreshSignal]);

  /**
   * Manual refresh request
   */
  const requestRefresh = useCallback(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  /**
   * Visibility change handler
   *
   * Note: React Query's refetchOnWindowFocus handles data refetching automatically.
   * This handler only manages auth refresh and isRefreshing state for UI purposes
   * (preventing false login modals during refresh).
   */
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Page is being hidden - record timestamp
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        // Page is becoming visible again
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;

        if (hiddenAt) {
          const backgroundDuration = Date.now() - hiddenAt;
          logger.info("Returned after backgrounding", {
            durationMs: backgroundDuration
          });

          // Only trigger auth refresh for longer backgrounds
          // React Query handles data refetching via refetchOnWindowFocus
          if (backgroundDuration >= CONFIG.MIN_BACKGROUND_FOR_REFRESH) {
            if (debounceTimeout) {
              clearTimeout(debounceTimeout);
            }

            debounceTimeout = setTimeout(() => {
              triggerRefresh();
            }, CONFIG.DEBOUNCE_MS);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [triggerRefresh]);

  return (
    <RecoveryContext.Provider
      value={{
        ...state,
        requestRefresh,
        subscribeToRefresh,
        notifyAuthRefreshed,
        requestAuthRefresh,
        registerAuthRefreshHandler,
      }}
    >
      {children}
    </RecoveryContext.Provider>
  );
}

/**
 * Hook to access recovery context
 */
export function useRecoveryContext() {
  const context = useContext(RecoveryContext);
  if (!context) {
    throw new Error(
      "useRecoveryContext must be used within an AppRecoveryProvider"
    );
  }
  return context;
}
