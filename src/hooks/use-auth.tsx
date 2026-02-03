"use client";

/**
 * Authentication Hook and Context
 *
 * Provides authentication state management using Supabase Auth.
 * Handles login, signup, logout, and session management.
 *
 * Integrates with the App Recovery system to:
 * - Add timeout protection to auth operations
 * - Track auth confidence level (confirmed vs cached)
 * - Register auth refresh handler for recovery
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
 */
function tryUseRecoveryContext() {
  try {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRecoveryContext } = require("@/providers/app-recovery-provider");
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

  // Fetch user profile with timeout
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const supabase = getClient();
        const result = await withTimeout(
          supabase.from("profiles").select("*").eq("id", userId).single().then(res => res),
          TIMEOUTS.DATA_QUERY,
          "Profile fetch timed out"
        );

        if (result.error) {
          console.error("Error fetching profile:", result.error);
          return null;
        }

        return result.data as Profile;
      } catch (error) {
        if (isTimeoutError(error)) {
          console.warn("[Auth] Profile fetch timed out, continuing with null profile");
        } else {
          console.error("Error fetching profile:", error);
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
    console.log("[Auth] Recovery refresh requested");

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
        console.log("[Auth] Explicit auth error during recovery:", sessionResult.error.message);
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
        console.warn("[Auth] Session check timed out, keeping cached auth state");
        setState((prev) => ({
          ...prev,
          confidence: "cached",
        }));
        return "cached";
      }

      // Unknown error - keep cached state
      console.error("[Auth] Recovery refresh error:", error);
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

        // Use timeout for initial session check
        const initResult = await withTimeout(
          supabase.auth.getSession().then(res => res),
          TIMEOUTS.AUTH_SESSION,
          "Initial auth check timed out"
        );

        if (initResult.error) {
          console.error("Auth error during init:", initResult.error);
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
          const profile = await fetchProfile(initResult.data.session.user.id);
          setState({
            user: initResult.data.session.user,
            profile,
            session: initResult.data.session,
            loading: false,
            initialized: true,
            confidence: "confirmed",
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
          console.warn("[Auth] Initial auth check timed out");
          setState((prev) => ({
            ...prev,
            loading: false,
            initialized: true,
            confidence: "unknown",
          }));
        } else {
          console.error("Error initializing auth:", error);
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
      console.log("[Auth] Auth state change:", event);

      if (event === "SIGNED_IN" && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          session,
          loading: false,
          initialized: true,
          confidence: "confirmed",
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
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Register auth refresh handler with recovery system
  useEffect(() => {
    if (hasRegisteredHandler.current) return;

    // Try to get recovery context and register handler
    const recoveryContext = tryUseRecoveryContext();
    if (recoveryContext?.registerAuthRefreshHandler) {
      recoveryContext.registerAuthRefreshHandler(recoveryRefreshAuth);
      hasRegisteredHandler.current = true;
      console.log("[Auth] Registered auth refresh handler with recovery system");
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
            console.error("Error creating profile:", profileError);
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
        console.warn("[Auth] Session refresh timed out");
        // Keep existing session, mark as cached
        setState((prev) => ({ ...prev, confidence: "cached" }));
      } else {
        console.error("[Auth] Session refresh error:", error);
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
