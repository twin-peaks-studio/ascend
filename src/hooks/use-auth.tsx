"use client";

/**
 * Authentication Hook and Context
 *
 * Provides authentication state management using Supabase Auth.
 * Handles login, signup, logout, and session management.
 *
 * ## Performance Optimization: Non-Blocking Profile Fetch
 *
 * On SIGNED_IN events, the user state is set IMMEDIATELY without waiting
 * for profile fetch. This allows data hooks (with `enabled: !!user`) to
 * start fetching right away, dramatically improving initial page load time.
 *
 * Profile is fetched in the background and state is updated when it completes.
 * If profile fetch fails, the app continues to work (profile is non-critical).
 *
 * ## Safety Patterns
 *
 * - `isMountedRef`: Prevents state updates after component unmount
 * - `prev.user` check: Prevents profile update if user signed out during fetch
 * - Longer timeouts for initial load vs shorter for recovery
 *
 * ## Integration with App Recovery
 *
 * - Timeout protection on all auth operations
 * - Auth confidence tracking (confirmed vs cached vs unknown)
 * - Recovery refresh handler for mobile backgrounding
 *
 * @see docs/TECHNICAL_GUIDE.md "Auth Initialization & Performance" section
 * @see src/lib/utils/with-timeout.ts for timeout configuration
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS, isTimeoutError } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import type { AuthConfidence } from "@/providers/app-recovery-provider";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  /** Confidence level in current auth state */
  confidence: AuthConfidence;
}

interface SignUpData {
  email: string;
  password: string;
  name: string;
}

interface SignInData {
  email: string;
  password: string;
}

interface AuthContextValue extends AuthState {
  signUp: (data: SignUpData) => Promise<{ error: AuthError | Error | null }>;
  signIn: (data: SignInData) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /**
   * Internal method for recovery system to refresh auth
   * Returns the confidence level after refresh
   */
  _recoveryRefreshAuth: () => Promise<AuthConfidence>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Try to access recovery context - returns null if not available
 * (e.g., during initial render before AppRecoveryProvider mounts)
 *
 * Note: This function intentionally violates rules-of-hooks to handle circular dependencies
 * eslint-disable-next-line react-hooks/rules-of-hooks
 */
function useTryRecoveryContext() {
  try {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports, react-hooks/rules-of-hooks
    const { useRecoveryContext } = require("@/providers/app-recovery-provider");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRecoveryContext();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    initialized: false,
    confidence: "unknown",
  });

  // Track if we've registered the auth refresh handler
  const hasRegisteredHandler = useRef(false);

  // Try to get recovery context (called at top level to satisfy hooks rules)
  const recoveryContext = useTryRecoveryContext();

  // Track if this is the initial auth load (for longer timeout on cold start)
  const isInitialLoadRef = useRef(true);

  // Track if component is mounted (to prevent state updates after unmount)
  const isMountedRef = useRef(true);

  // Fetch user profile with timeout (used for recovery - short timeout)
  const fetchProfile = useCallback(
    async (userId: string, isInitialLoad = false): Promise<Profile | null> => {
      try {
        const supabase = getClient();
        // Use longer timeout for initial load, shorter for recovery
        const timeout = isInitialLoad ? TIMEOUTS.DATA_QUERY_INITIAL : TIMEOUTS.DATA_QUERY;
        const result = await withTimeout(
          supabase.from("profiles").select("*").eq("id", userId).single().then(res => res),
          timeout,
          "Profile fetch timed out"
        );

        if (result.error) {
          logger.error("Error fetching profile", {
            userId,
            error: result.error,
            isInitialLoad
          });
          return null;
        }

        return result.data as Profile;
      } catch (error) {
        if (isTimeoutError(error)) {
          logger.warn("Profile fetch timed out, continuing with null profile", {
            userId,
            isInitialLoad,
            timeout: isInitialLoad ? TIMEOUTS.DATA_QUERY_INITIAL : TIMEOUTS.DATA_QUERY
          });
        } else {
          logger.error("Error fetching profile", {
            userId,
            error,
            isInitialLoad
          });
        }
        return null;
      }
    },
    []
  );

  /**
   * Recovery refresh handler - called by AppRecoveryProvider during recovery
   * CRITICAL: Does NOT clear user on timeout - only on explicit auth failure
   */
  const recoveryRefreshAuth = useCallback(async (): Promise<AuthConfidence> => {
    logger.info("Recovery refresh requested");

    try {
      const supabase = getClient();

      // Try to get session with timeout
      const sessionResult = await withTimeout(
        supabase.auth.getSession().then(res => res),
        TIMEOUTS.AUTH_SESSION,
        "Auth session check timed out"
      );

      if (sessionResult.error) {
        // Explicit auth error - this is a real logout
        logger.info("Explicit auth error during recovery", {
          errorMessage: sessionResult.error.message
        });
        setState((prev) => ({
          ...prev,
          user: null,
          profile: null,
          session: null,
          confidence: "confirmed",
        }));
        return "confirmed";
      }

      if (sessionResult.data.session?.user) {
        // Session is valid
        const profile = await fetchProfile(sessionResult.data.session.user.id);
        setState((prev) => ({
          ...prev,
          user: sessionResult.data.session!.user,
          profile: profile ?? prev.profile, // Keep cached profile if fetch failed
          session: sessionResult.data.session,
          confidence: "confirmed",
        }));
        return "confirmed";
      } else {
        // No session - user is logged out
        setState((prev) => ({
          ...prev,
          user: null,
          profile: null,
          session: null,
          confidence: "confirmed",
        }));
        return "confirmed";
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        // CRITICAL: On timeout, keep cached auth state, don't clear user
        logger.warn("Session check timed out, keeping cached auth state", {
          timeout: TIMEOUTS.AUTH_SESSION
        });
        setState((prev) => ({
          ...prev,
          confidence: "cached",
        }));
        return "cached";
      }

      // Unknown error - keep cached state
      logger.error("Recovery refresh error", { error });
      setState((prev) => ({
        ...prev,
        confidence: "cached",
      }));
      return "cached";
    }
  }, [fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = getClient();

        // Use longer timeout for initial session check (cold start can be slow)
        // Recovery after backgrounding uses shorter AUTH_SESSION timeout
        const initResult = await withTimeout(
          supabase.auth.getSession().then(res => res),
          TIMEOUTS.AUTH_SESSION_INITIAL,
          "Initial auth check timed out"
        );

        if (initResult.error) {
          logger.error("Auth error during init", { error: initResult.error });
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            initialized: true,
            confidence: "confirmed",
          });
          return;
        }

        if (initResult.data.session?.user) {
          // CRITICAL: Set user immediately so data hooks can start fetching
          // Profile fetch is non-blocking
          setState({
            user: initResult.data.session.user,
            profile: null, // Will be updated when profile fetch completes
            session: initResult.data.session,
            loading: false,
            initialized: true,
            confidence: "confirmed",
          });

          // Fetch profile in background (non-blocking)
          fetchProfile(initResult.data.session.user.id, true).then((profile) => {
            // Only update if still mounted and user hasn't signed out
            if (profile && isMountedRef.current) {
              setState((prev) => (prev.user ? { ...prev, profile } : prev));
            }
          });
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            initialized: true,
            confidence: "confirmed",
          });
        }
      } catch (error) {
        if (isTimeoutError(error)) {
          // Initial timeout - mark as unknown confidence
          logger.warn("Initial auth check timed out", {
            timeout: TIMEOUTS.AUTH_SESSION_INITIAL
          });
          setState((prev) => ({
            ...prev,
            loading: false,
            initialized: true,
            confidence: "unknown",
          }));
        } else {
          logger.error("Error initializing auth", { error });
          setState((prev) => ({
            ...prev,
            loading: false,
            initialized: true,
            confidence: "unknown",
          }));
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const supabase = getClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      logger.info("Auth state change", {
        event,
        hasSession: !!session,
        userId: session?.user?.id
      });

      if (event === "SIGNED_IN" && session?.user) {
        // CRITICAL: Set user immediately so data hooks can start fetching
        // Profile fetch is non-blocking - we update profile when it completes
        setState({
          user: session.user,
          profile: null, // Will be updated when profile fetch completes
          session,
          loading: false,
          initialized: true,
          confidence: "confirmed",
        });

        // Fetch profile in background (non-blocking)
        const useInitialTimeout = isInitialLoadRef.current;
        isInitialLoadRef.current = false;
        fetchProfile(session.user.id, useInitialTimeout).then((profile) => {
          // Only update if still mounted and user hasn't signed out
          if (profile && isMountedRef.current) {
            setState((prev) => (prev.user ? { ...prev, profile } : prev));
          }
        });
      } else if (event === "SIGNED_OUT") {
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          initialized: true,
          confidence: "confirmed",
        });
      } else if (event === "TOKEN_REFRESHED" && session) {
        setState((prev) => ({
          ...prev,
          session,
          confidence: "confirmed",
        }));
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Register auth refresh handler with recovery system
  useEffect(() => {
    if (hasRegisteredHandler.current) return;

    // Register handler if recovery context is available
    if (recoveryContext?.registerAuthRefreshHandler) {
      recoveryContext.registerAuthRefreshHandler(recoveryRefreshAuth);
      hasRegisteredHandler.current = true;
      logger.info("Registered auth refresh handler with recovery system");
    }
  }, [recoveryRefreshAuth]);

  // Sign up with email and password
  const signUp = useCallback(
    async (data: SignUpData): Promise<{ error: AuthError | Error | null }> => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const supabase = getClient();

        // Validate password strength
        const passwordError = validatePassword(data.password);
        if (passwordError) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error: new Error(passwordError) };
        }

        // Sign up with Supabase Auth
        const signUpResult = await withTimeout(
          supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              data: {
                display_name: data.name,
              },
            },
          }).then(res => res),
          TIMEOUTS.AUTH_SESSION,
          "Sign up timed out"
        );

        if (signUpResult.error) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error: signUpResult.error };
        }
        const authData = signUpResult.data;

        // Create profile if user was created
        if (authData.user) {
          const { error: profileError } = await supabase.from("profiles").upsert(
            {
              id: authData.user.id,
              email: data.email,
              display_name: data.name,
            },
            { onConflict: "id" }
          );

          if (profileError) {
            logger.error("Error creating profile", {
              userId: authData.user.id,
              email: data.email,
              error: profileError
            });
          }
        }

        setState((prev) => ({ ...prev, loading: false }));
        return { error: null };
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }));
        return {
          error: error instanceof Error ? error : new Error("Unknown error"),
        };
      }
    },
    []
  );

  // Sign in with email and password
  const signIn = useCallback(
    async (data: SignInData): Promise<{ error: AuthError | Error | null }> => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const supabase = getClient();

        const signInResult = await withTimeout(
          supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          }).then(res => res),
          TIMEOUTS.AUTH_SESSION,
          "Sign in timed out"
        );

        if (signInResult.error) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error: signInResult.error };
        }

        return { error: null };
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }));
        return {
          error: error instanceof Error ? error : new Error("Unknown error"),
        };
      }
    },
    []
  );

  // Sign out
  const signOut = useCallback(async () => {
    const supabase = getClient();

    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      initialized: true,
      confidence: "confirmed",
    });
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const supabase = getClient();

      const refreshResult = await withTimeout(
        supabase.auth.refreshSession().then(res => res),
        TIMEOUTS.AUTH_REFRESH,
        "Session refresh timed out"
      );

      if (refreshResult.data.session) {
        setState((prev) => ({
          ...prev,
          session: refreshResult.data.session,
          confidence: "confirmed",
        }));
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        logger.warn("Session refresh timed out", {
          timeout: TIMEOUTS.AUTH_REFRESH
        });
        // Keep existing session, mark as cached
        setState((prev) => ({ ...prev, confidence: "cached" }));
      } else {
        logger.error("Session refresh error", { error });
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signOut,
        refreshSession,
        _recoveryRefreshAuth: recoveryRefreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Validate password strength
 * Returns error message if invalid, null if valid
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }

  return null;
}

/**
 * Get password requirements for display
 */
export function getPasswordRequirements(): string[] {
  return [
    "At least 8 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
  ];
}
