"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEstimate } from "@/hooks/use-task-estimation";
import type { DaySummary } from "@/hooks/use-task-estimation";

interface DaySummaryBannerProps {
  summary: DaySummary;
}

export function DaySummaryBanner({ summary }: DaySummaryBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const pct = Math.round(summary.completionLikelihood * 100);

  // Color based on likelihood
  const barColor =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    pct >= 70 ? "text-green-600 dark:text-green-400" : pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border bg-card p-4 mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Day Estimate</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-semibold tabular-nums", textColor)}>
            {pct}% likely
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{formatEstimate(summary.totalMinutes)}</span> estimated
            </span>
            <span className={cn("font-medium", textColor)}>{pct}% completion likelihood</span>
          </div>

          {/* AI message */}
          <p className="text-sm text-muted-foreground">{summary.message}</p>
        </div>
      )}
    </div>
  );
}
