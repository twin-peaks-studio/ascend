"use client";

import { useState, useCallback } from "react";
import { getHours, getMinutes } from "date-fns";
import type { TaskWithProject } from "@/types";

export interface TaskEstimate {
  id: string;
  estimatedMinutes: number;
  confidence: number;
}

export interface DaySummary {
  totalMinutes: number;
  completionLikelihood: number;
  message: string;
}

/**
 * Calculates remaining minutes from now until end of workday (10 PM).
 */
function getRemainingMinutesToday(): number {
  const now = new Date();
  const endHour = 22; // 10 PM
  const remainingMinutes =
    (endHour - getHours(now)) * 60 - getMinutes(now);
  return Math.max(0, remainingMinutes);
}

/**
 * Formats estimated minutes into a human-readable string (e.g. "30 min", "1.5h").
 */
export function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function useTaskEstimation() {
  const [estimates, setEstimates] = useState<Map<string, TaskEstimate>>(new Map());
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTaskId, setIsLoadingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callEstimateApi = useCallback(
    async (tasks: TaskWithProject[]): Promise<{ estimates: TaskEstimate[]; summary: DaySummary } | null> => {
      const payload = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        projectName: t.project?.title ?? null,
      }));

      const remainingMinutesInDay = getRemainingMinutesToday();

      const response = await fetch("/api/ai/estimate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload, remainingMinutesInDay }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Estimation failed");
      }

      return { estimates: data.estimates, summary: data.summary };
    },
    []
  );

  /**
   * Run AI estimation for all provided tasks at once.
   */
  const estimateAll = useCallback(
    async (tasks: TaskWithProject[]) => {
      if (tasks.length === 0) return;
      setIsLoading(true);
      setError(null);

      try {
        const result = await callEstimateApi(tasks);
        if (!result) return;

        const newEstimates = new Map(estimates);
        for (const est of result.estimates) {
          newEstimates.set(est.id, est);
        }
        setEstimates(newEstimates);
        setDaySummary(result.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Estimation failed");
      } finally {
        setIsLoading(false);
      }
    },
    [estimates, callEstimateApi]
  );

  /**
   * Re-run AI estimation for a single task.
   */
  const estimateOne = useCallback(
    async (task: TaskWithProject) => {
      setIsLoadingTaskId(task.id);
      setError(null);

      try {
        const result = await callEstimateApi([task]);
        if (!result || result.estimates.length === 0) return;

        const est = result.estimates[0];
        setEstimates((prev) => new Map(prev).set(est.id, est));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Estimation failed");
      } finally {
        setIsLoadingTaskId(null);
      }
    },
    [callEstimateApi]
  );

  const getEstimate = useCallback(
    (taskId: string): TaskEstimate | undefined => estimates.get(taskId),
    [estimates]
  );

  const hasEstimates = estimates.size > 0;

  return {
    estimateAll,
    estimateOne,
    getEstimate,
    daySummary,
    isLoading,
    isLoadingTaskId,
    hasEstimates,
    error,
  };
}
