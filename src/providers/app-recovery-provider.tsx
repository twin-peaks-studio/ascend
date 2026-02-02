"use client";

/**
 * App Recovery Provider
 *
 * Centralized manager for handling app recovery after mobile backgrounding.
 * This provider owns the SINGLE visibility change listener and coordinates
 * the recovery sequence:
 *
 * 1. Connection health check
 * 2. Auth session refresh
 * 3. Data refresh signal
 *
 * This solves the race condition issues from previous attempts where
 * auth and data handlers ran independently.
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
import {
  checkHealthWithReset,
  getClient,
  resetClient,
} from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS, isTimeoutError } from "@/lib/utils/with-timeout";

/**
 * Recovery status states
 */
export type RecoveryStatus = "idle" | "recovering" | "healthy" | "degraded";

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
  /** When the last recovery completed */
  lastRecoveryAt: number | null;
  /** Whether the connection is healthy */
  connectionHealthy: boolean;
  /** Auth confidence level after recovery */
  authConfidence: AuthConfidence;
}

/**
 * Recovery context value
 */
interface RecoveryContextValue extends RecoveryState {
  /** Manually trigger recovery (e.g., after mutation failure) */
  requestRecovery: () => void;
  /** Subscribe to data refresh signals */
  subscribeToRefresh: (callback: () => void) => () => void;
  /** Notify that auth has been refreshed (called by AuthProvider) */
  notifyAuthRefreshed: (confidence: AuthConfidence) => void;
  /** Request auth refresh (called during recovery) */
  requestAuthRefresh: () => Promise<void>;
  /** Register auth refresh handler */
  registerAuthRefreshHandler: (handler: () => Promise<AuthConfidence>) => void;
}

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

interface AppRecoveryProviderProps {
  children: ReactNode;
}

export function AppRecoveryProvider({ children }: AppRecoveryProviderProps) {
  const [state, setState] = useState<RecoveryState>({
    status: "idle",
    lastRecoveryAt: null,
    connectionHealthy: true,
    authConfidence: "unknown",
  });

  // Track when page was hidden
  const hiddenAtRef = useRef<number | null>(null);

  // Prevent concurrent recovery runs
  const isRecoveringRef = useRef(false);

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
   * Request auth refresh during recovery
   */
  const requestAuthRefresh = useCallback(async (): Promise<void> => {
    if (authRefreshHandler.current) {
      try {
        const confidence = await authRefreshHandler.current();
        setState((prev) => ({ ...prev, authConfidence: confidence }));
      } catch (error) {
        console.warn("[AppRecovery] Auth refresh failed:", error);
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
    refreshSubscribers.current.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("[AppRecovery] Refresh subscriber error:", error);
      }
    });
  }, []);

  /**
   * Main recovery sequence
   */
  const runRecovery = useCallback(async () => {
    if (isRecoveringRef.current) {
      return;
    }

    isRecoveringRef.current = true;
    setState((prev) => ({ ...prev, status: "recovering" }));

    console.log("[AppRecovery] Starting recovery sequence...");

    try {
      // Step 1: Check connection health (with automatic reset on failure)
      const connectionHealthy = await checkHealthWithReset();

      setState((prev) => ({ ...prev, connectionHealthy }));

      if (!connectionHealthy) {
        console.warn("[AppRecovery] Connection unhealthy after reset");
        setState((prev) => ({
          ...prev,
          status: "degraded",
          lastRecoveryAt: Date.now(),
        }));
        return;
      }

      // Step 2: Refresh auth session
      console.log("[AppRecovery] Refreshing auth session...");
      await requestAuthRefresh();

      // Step 3: Signal data hooks to refresh
      console.log("[AppRecovery] Signaling data refresh...");
      emitRefreshSignal();

      // Recovery complete
      setState((prev) => ({
        ...prev,
        status: "healthy",
        lastRecoveryAt: Date.now(),
      }));

      console.log("[AppRecovery] Recovery complete");
    } catch (error) {
      console.error("[AppRecovery] Recovery failed:", error);
      setState((prev) => ({
        ...prev,
        status: "degraded",
        lastRecoveryAt: Date.now(),
      }));
    } finally {
      isRecoveringRef.current = false;
    }
  }, [requestAuthRefresh, emitRefreshSignal]);

  /**
   * Manual recovery request
   */
  const requestRecovery = useCallback(() => {
    runRecovery();
  }, [runRecovery]);

  /**
   * Visibility change handler
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

          // Only trigger recovery if backgrounded for minimum duration
          if (backgroundDuration >= TIMEOUTS.MIN_BACKGROUND) {
            console.log(
              `[AppRecovery] Page was backgrounded for ${backgroundDuration}ms, triggering recovery`
            );

            // Debounce to avoid rapid fire on quick tab switches
            if (debounceTimeout) {
              clearTimeout(debounceTimeout);
            }

            debounceTimeout = setTimeout(() => {
              runRecovery();
            }, TIMEOUTS.DEBOUNCE);
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
  }, [runRecovery]);

  /**
   * Initial recovery on mount (in case app was closed and reopened)
   */
  useEffect(() => {
    // Run a health check on mount to establish initial state
    checkHealthWithReset().then((healthy) => {
      setState((prev) => ({
        ...prev,
        connectionHealthy: healthy,
        status: healthy ? "healthy" : "degraded",
      }));
    });
  }, []);

  return (
    <RecoveryContext.Provider
      value={{
        ...state,
        requestRecovery,
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
