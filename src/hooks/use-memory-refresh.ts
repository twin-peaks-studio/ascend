"use client";

/**
 * AI Memory Refresh Hook
 *
 * Manages the client-side state for triggering and displaying AI memory refresh.
 * Calls POST /api/ai/memory-refresh and updates the entity cache on success.
 *
 * Supports source change detection: if sources haven't changed since the last
 * refresh, the API returns skipped: true and no Claude call is made.
 * Pass { force: true } to bypass the hash check.
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { entityKeys } from "@/hooks/use-entities";
import { logger } from "@/lib/logger/logger";
import { toast } from "sonner";
import type { Entity } from "@/types/database";

interface RefreshResult {
  aiMemory: string;
  refreshedAt: string;
  skipped?: boolean;
  sources: {
    foundationalContext: boolean;
    journalEntries: number;
    mentions: number;
    linkedTasks: number;
  };
}

export function useMemoryRefresh(entityId: string | null) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async (options?: { force?: boolean }): Promise<RefreshResult | null> => {
    if (!entityId) return null;

    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch("/api/ai/memory-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, force: options?.force }),
      });

      const data = await response.json();

      if (!data.success) {
        const message = data.error?.message || "Memory refresh failed";
        setError(message);
        toast.error(message);
        return null;
      }

      // Optimistically update the entity cache with new memory
      queryClient.setQueryData<Entity | null>(
        entityKeys.detail(entityId),
        (old) =>
          old
            ? {
                ...old,
                ai_memory: data.aiMemory,
                memory_refreshed_at: data.refreshedAt,
              }
            : old
      );

      if (data.skipped) {
        toast.info("Sources unchanged since last refresh. No update needed.");
      } else {
        const sources: string[] = [];
        if (data.sources.foundationalContext) sources.push("foundational context");
        if (data.sources.journalEntries > 0) sources.push(`${data.sources.journalEntries} journal entries`);
        if (data.sources.mentions > 0) sources.push(`${data.sources.mentions} mentions`);
        if (data.sources.linkedTasks > 0) sources.push(`${data.sources.linkedTasks} linked tasks`);

        toast.success(`Memory refreshed from ${sources.join(", ")}`);
      }

      return {
        aiMemory: data.aiMemory,
        refreshedAt: data.refreshedAt,
        skipped: data.skipped,
        sources: data.sources,
      };
    } catch (err) {
      const message = "Failed to refresh memory. Please try again.";
      setError(message);
      toast.error(message);
      logger.error("Memory refresh failed", { entityId, error: err });
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [entityId, queryClient]);

  return { refresh, refreshing, error };
}
