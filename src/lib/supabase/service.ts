/**
 * Supabase Service Role Client
 *
 * This client bypasses RLS and should ONLY be used in trusted server-side
 * contexts like Inngest functions, cron jobs, and webhooks where there is
 * no user session/cookie context available.
 *
 * SECURITY NOTE:
 * - This client bypasses ALL Row Level Security policies
 * - Never expose the service role key to the client
 * - Only use in API routes and server-side background jobs
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Creates a Supabase client using the service role key.
 * Used for server-side operations without a user session (e.g., Inngest functions).
 */
export function createServiceClient() {
  if (serviceClient) return serviceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env.local file."
    );
  }

  serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return serviceClient;
}
