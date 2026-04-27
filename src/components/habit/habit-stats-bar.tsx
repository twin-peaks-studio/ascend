"use client";

import { Flame, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitStats } from "@/types";
import type { Habit } from "@/types";

interface HabitStatsBarProps {
  stats: HabitStats;
  habit: Habit;
  className?: string;
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

function StatChip({ icon, label, value, subtext, highlight }: StatChipProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl px-4 py-3 min-w-[80px]",
        highlight ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/60"
      )}
    >
      <div className={cn("mb-1", highlight ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <span className="text-xl font-bold tabular-nums leading-none">{value}</span>
      {subtext && (
        <span className="text-xs text-muted-foreground">{subtext}</span>
      )}
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

export function HabitStatsBar({ stats, habit, className }: HabitStatsBarProps) {
  const weekLabel =
    habit.frequency_type === "daily"
      ? "this week"
      : habit.frequency_type === "weekly"
      ? `/ ${habit.frequency_count} this week`
      : "this month";

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <StatChip
        icon={<Flame size={16} />}
        label="streak"
        value={stats.currentStreak}
        subtext={stats.currentStreak !== stats.longestStreak ? `best: ${stats.longestStreak}` : "personal best!"}
        highlight={stats.currentStreak > 0}
      />
      <StatChip
        icon={<Calendar size={16} />}
        label={weekLabel}
        value={`${stats.completedThisWeek}/${stats.targetThisWeek}`}
        subtext={`${Math.round(stats.completionRateThisWeek * 100)}%`}
      />
      <StatChip
        icon={<TrendingUp size={16} />}
        label="last 30 days"
        value={`${Math.round(stats.completionRateLast30Days * 100)}%`}
      />
      <StatChip
        icon={<CheckCircle2 size={16} />}
        label="total done"
        value={stats.completedTotal}
      />
    </div>
  );
}
