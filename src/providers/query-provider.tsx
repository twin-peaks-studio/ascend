"use client";

/**
 * React Query Provider
 *
 * Provides request deduplication, caching, and automatic refetching.
 * Configured to work with our mobile backgrounding recovery system.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TIMEOUTS } from "@/lib/utils/with-timeout";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data while fetching fresh data in background
        staleTime: 30 * 1000, // Data is fresh for 30 seconds
        gcTime: 5 * 60 * 1000, // Cache for 5 minutes (formerly cacheTime)

        // Retry configuration
        retry: 1, // Retry once on failure
        retryDelay: 100, // Small delay before retry

        // Network mode - always fetch, don't wait for online
        networkMode: "always",

        // Refetch on window focus (helps with mobile backgrounding)
        refetchOnWindowFocus: true,

        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
      },
      mutations: {
        // Mutations shouldn't retry by default
        retry: false,
        networkMode: "always",
      },
    },
  });
}

// Browser: create one client that's reused
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: reuse client across renders
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use useState to ensure client is created once per component instance
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Export for use in hooks that need to invalidate queries
export { getQueryClient };
