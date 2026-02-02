"use client";

/**
 * Authentication Hook and Context
 *
 * Provides authentication state management using Supabase Auth.
 * Handles login, signup, logout, and session management.
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    initialized: false,
  });

  const supabase = createClient();

  // Fetch user profile
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data as Profile;
    },
    [supabase]
  );

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            initialized: true,
          });
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            initialized: true,
          });
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setState((prev) => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          session,
          loading: false,
          initialized: true,
        });
      } else if (event === "SIGNED_OUT") {
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          initialized: true,
        });
      } else if (event === "TOKEN_REFRESHED" && session) {
        setState((prev) => ({ ...prev, session }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Sign up with email and password
  const signUp = useCallback(
    async (data: SignUpData): Promise<{ error: AuthError | Error | null }> => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        // Validate password strength
        const passwordError = validatePassword(data.password);
        if (passwordError) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error: new Error(passwordError) };
        }

        // Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: data.email,
            password: data.password,
            options: {
              data: {
                display_name: data.name,
              },
            },
          }
        );

        if (authError) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error: authError };
        }

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
        return { error: error instanceof Error ? error : new Error("Unknown error") };
      }
    },
    [supabase]
  );

  // Sign in with email and password
  const signIn = useCallback(
    async (data: SignInData): Promise<{ error: AuthError | Error | null }> => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) {
          setState((prev) => ({ ...prev, loading: false }));
          return { error };
        }

        return { error: null };
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }));
        return { error: error instanceof Error ? error : new Error("Unknown error") };
      }
    },
    [supabase]
  );

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      initialized: true,
    });
  }, [supabase]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    if (session) {
      setState((prev) => ({ ...prev, session }));
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signOut,
        refreshSession,
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
