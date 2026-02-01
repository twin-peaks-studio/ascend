/**
 * Supabase Server Client
 *
 * This client is used in Server Components, Server Actions, and Route Handlers.
 * It handles cookie-based auth and runs on the server.
 *
 * SECURITY NOTE:
 * - This client has access to cookies for session management
 * - Server-side operations bypass browser limitations
 * - Still respects RLS policies unless using service_role key
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for server-side usage.
 * Call this function in Server Components, Server Actions, or Route Handlers.
 *
 * @example
 * ```tsx
 * // In a Server Component
 * import { createClient } from "@/lib/supabase/server";
 *
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("projects").select("*");
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // In a Server Action
 * "use server";
 * import { createClient } from "@/lib/supabase/server";
 *
 * export async function createProject(formData: FormData) {
 *   const supabase = await createClient();
 *   // ... perform database operations
 * }
 * ```
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file."
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
