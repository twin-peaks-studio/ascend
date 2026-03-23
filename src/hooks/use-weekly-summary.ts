"use client";

import { useState, useCallback } from "react";
import type { SuggestedTask } from "@/app/api/ai/weekly-summary/route";

export type { SuggestedTask };

export interface WeeklySummary {
  summary: string;
  entityCount: number;
  suggestions: SuggestedTask[];
}

const SESSION_KEY = "today-weekly-summary";

function readFromSession(): WeeklySummary | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as WeeklySummary) : null;
  } catch {
    return null;
  }
}

function writeToSession(value: WeeklySummary | null) {
  try {
    if (value) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // sessionStorage unavailable (SSR) — ignore
  }
}

export function useWeeklySummary() {
  const [summary, setSummary] = useState<WeeklySummary | null>(() => readFromSession());
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

      const result: WeeklySummary = {
        summary: data.summary,
        entityCount: data.entityCount,
        suggestions: data.suggestions ?? [],
      };
      setSummary(result);
      writeToSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate weekly summary");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSummary(null);
    setError(null);
    writeToSession(null);
  }, []);

  return { summary, isLoading, error, generate, clear };
}
