/**
 * Supabase Browser Client
 *
 * This client is used in Client Components (components that use "use client").
 * It runs in the browser and handles real-time subscriptions and client-side queries.
 *
 * SECURITY NOTE:
 * - The anon key is safe to expose in the browser
 * - Row Level Security (RLS) policies protect data at the database level
 * - Never expose the service_role key in client code
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for browser/client-side usage.
 * Call this function to get a client instance in your Client Components.
 *
 * @example
 * ```tsx
 * "use client";
 * import { createClient } from "@/lib/supabase/client";
 *
 * export function MyComponent() {
 *   const supabase = createClient();
 *   // Use supabase for queries, subscriptions, etc.
 * }
 * ```
 */
export function createClient() {
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
