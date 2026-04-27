"use client";

import Link from "next/link";
import { Flame, ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HabitProgressRing } from "@/components/habit/habit-progress-ring";
import { useHabits } from "@/hooks/use-habits";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import { computeHabitStats } from "@/hooks/use-habit-stats";
import { cn } from "@/lib/utils";
import type { Habit } from "@/types";

function HabitRingItem({ habit }: { habit: Habit }) {
  const { entries } = useHabitEntries(habit.id);
  const stats = computeHabitStats(habit, entries);

  return (
    <Link
      href={`/habits/${habit.id}`}
      className="flex flex-col items-center gap-1.5 group hover:opacity-80 transition-opacity"
    >
      <div className="relative">
        <HabitProgressRing
          completed={stats.completedThisWeek}
          target={stats.targetThisWeek}
          size={52}
          strokeWidth={5}
        />
        <div className="absolute inset-0 flex items-center justify-center text-lg">
          {habit.icon ?? "🎯"}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground truncate max-w-[56px]">{habit.title}</p>
        {stats.currentStreak > 0 && (
          <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5">
            <Flame size={9} />
            {stats.currentStreak}
          </p>
        )}
      </div>
    </Link>
  );
}

export function HabitDashboardWidget() {
  const { habits, loading } = useHabits();
  const activeHabits = habits.filter((h) => !h.is_archived);

  if (loading || activeHabits.length === 0) return null;

  const displayHabits = activeHabits.slice(0, 6);
  const remaining = activeHabits.length - displayHabits.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame size={16} className="text-amber-500" />
            Habits
          </CardTitle>
          <Link
            href="/habits"
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
            <ChevronRight size={12} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start gap-4 flex-wrap">
          {displayHabits.map((habit) => (
            <HabitRingItem key={habit.id} habit={habit} />
          ))}
          {remaining > 0 && (
            <Link
              href="/habits"
              className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <div
                className={cn(
                  "w-[52px] h-[52px] rounded-full border-2 border-dashed border-muted-foreground/30",
                  "flex items-center justify-center text-xs text-muted-foreground font-medium"
                )}
              >
                +{remaining}
              </div>
              <p className="text-[10px] text-muted-foreground">more</p>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
