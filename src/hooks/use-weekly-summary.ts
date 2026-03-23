"use client";

import { useState, useCallback } from "react";

export interface WeeklySummary {
  summary: string;
  entityCount: number;
}

export function useWeeklySummary() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate summary");
      }

      setSummary({ summary: data.summary, entityCount: data.entityCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate weekly summary");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  return { summary, isLoading, error, generate, clear };
}
