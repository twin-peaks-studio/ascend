"use client";

/**
 * useFormTracker
 *
 * Polls GET /api/forms/[slug]/tracker every 30 seconds and returns
 * all tasks linked to the form for the tester issue tracker.
 *
 * Uses React Query with refetchInterval so the page stays up-to-date
 * without Supabase Realtime (testers are not authenticated Supabase users).
 */

import { useQuery } from "@tanstack/react-query";
import type { TrackerTask } from "@/types";

interface TrackerResponse {
  success: boolean;
  tasks?: TrackerTask[];
  error?: { type: string; message: string };
}

const POLL_INTERVAL_MS = 30_000;

export function useFormTracker(slug: string) {
  const { data, isLoading, error, isError } = useQuery<TrackerResponse>({
    queryKey: ["form-tracker", slug],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${slug}/tracker`);
      return res.json() as Promise<TrackerResponse>;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 2,
    staleTime: POLL_INTERVAL_MS,
  });

  const unauthenticated =
    isError || (data && !data.success && data.error?.type === "unauthenticated") ||
    (data && !data.success && data.error?.type === "session_invalidated");

  return {
    tasks: data?.success ? (data.tasks ?? []) : [],
    isLoading,
    isError,
    unauthenticated: Boolean(unauthenticated),
    errorMessage: data?.error?.message,
  };
}
