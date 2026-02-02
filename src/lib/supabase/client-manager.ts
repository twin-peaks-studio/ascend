/**
 * Supabase Client Manager
 *
 * Provides a singleton Supabase client with health checking capabilities.
 * This is critical for handling mobile backgrounding scenarios where
 * connections can become stale.
 *
 * Key features:
 * - Singleton pattern for consistent client reference across the app
 * - Health checking to detect stale connections
 * - Ability to reset client after backgrounding
 * - Event system for health status changes
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { withTimeout, TIMEOUTS, isTimeoutError } from "@/lib/utils/with-timeout";

type HealthCallback = (healthy: boolean) => void;

/** Singleton client instance */
let clientInstance: SupabaseClient<Database> | null = null;

/** Health status */
let isHealthy = true;

/** Subscribers to health changes */
const healthListeners: Set<HealthCallback> = new Set();

/**
 * Creates a new Supabase client instance
 */
function createNewClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file."
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Gets the current Supabase client instance.
 * Creates a new instance if one doesn't exist.
 *
 * @returns The Supabase client
 *
 * @example
 * ```typescript
 * const supabase = getClient();
 * const { data } = await supabase.from('tasks').select('*');
 * ```
 */
export function getClient(): SupabaseClient<Database> {
  if (!clientInstance) {
    clientInstance = createNewClient();
  }
  return clientInstance;
}

/**
 * Resets the client instance, forcing a new client to be created
 * on the next getClient() call. Use this after detecting a stale
 * connection (e.g., after mobile backgrounding).
 *
 * @example
 * ```typescript
 * // After detecting stale connection
 * resetClient();
 * const freshClient = getClient();
 * ```
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Updates the health status and notifies listeners
 */
function setHealthStatus(healthy: boolean): void {
  if (isHealthy !== healthy) {
    isHealthy = healthy;
    healthListeners.forEach((callback) => callback(healthy));
  }
}

/**
 * Performs a lightweight health check to verify the Supabase connection.
 * This uses a simple query that should complete quickly if the connection
 * is healthy.
 *
 * @returns true if the connection is healthy, false otherwise
 *
 * @example
 * ```typescript
 * const healthy = await checkHealth();
 * if (!healthy) {
 *   resetClient();
 *   // Retry operations with fresh client
 * }
 * ```
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const client = getClient();

    // Use a lightweight query to check connectivity
    // We query the profiles table with a limit of 0 - this just tests connectivity
    // without actually fetching data
    await withTimeout(
      client.from("profiles").select("id", { count: "exact", head: true }),
      TIMEOUTS.HEALTH_CHECK,
      "Health check timed out"
    );

    setHealthStatus(true);
    return true;
  } catch (error) {
    console.warn("[ClientManager] Health check failed:", error);
    setHealthStatus(false);
    return false;
  }
}

/**
 * Performs a health check with automatic client reset on failure.
 * If the first check fails, resets the client and tries once more.
 *
 * @returns true if the connection is healthy (after potential reset), false otherwise
 */
export async function checkHealthWithReset(): Promise<boolean> {
  const firstCheck = await checkHealth();

  if (firstCheck) {
    return true;
  }

  // First check failed, reset client and try again
  console.log("[ClientManager] First health check failed, resetting client...");
  resetClient();

  const secondCheck = await checkHealth();

  if (!secondCheck) {
    console.warn(
      "[ClientManager] Health check failed after client reset - connection may be unavailable"
    );
  }

  return secondCheck;
}

/**
 * Gets the current health status without performing a check
 *
 * @returns The current health status
 */
export function getHealthStatus(): boolean {
  return isHealthy;
}

/**
 * Subscribes to health status changes
 *
 * @param callback - Function to call when health status changes
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = onHealthChange((healthy) => {
 *   if (!healthy) {
 *     showOfflineBanner();
 *   }
 * });
 *
 * // Later, to unsubscribe
 * unsubscribe();
 * ```
 */
export function onHealthChange(callback: HealthCallback): () => void {
  healthListeners.add(callback);
  return () => {
    healthListeners.delete(callback);
  };
}

/**
 * Wraps a Supabase query with timeout protection.
 * If the query times out, marks the connection as unhealthy.
 *
 * @param queryFn - Function that performs the Supabase query
 * @param timeoutMs - Timeout in milliseconds (default: DATA_QUERY timeout)
 * @returns The query result
 *
 * @example
 * ```typescript
 * const { data, error } = await withHealthTracking(
 *   () => supabase.from('tasks').select('*')
 * );
 * ```
 */
export async function withHealthTracking<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = TIMEOUTS.DATA_QUERY
): Promise<T> {
  try {
    const result = await withTimeout(queryFn(), timeoutMs);
    setHealthStatus(true);
    return result;
  } catch (error) {
    if (isTimeoutError(error)) {
      setHealthStatus(false);
    }
    throw error;
  }
}
