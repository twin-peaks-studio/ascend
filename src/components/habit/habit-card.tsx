"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, CheckCircle2, Circle, Pencil, Archive, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HabitProgressRing } from "@/components/habit/habit-progress-ring";
import { HabitStreakBadge } from "@/components/habit/habit-streak-badge";
import { HabitCheckInDialog } from "@/components/habit/habit-check-in-dialog";
import { HabitCreateDialog } from "@/components/habit/habit-create-dialog";
import { useHabitMutations } from "@/hooks/use-habits";
import { cn } from "@/lib/utils";
import type { Habit, HabitStats } from "@/types";

interface HabitCardProps {
  habit: Habit;
  stats: HabitStats;
}

export function HabitCard({ habit, stats }: HabitCardProps) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { archiveHabit, deleteHabit } = useHabitMutations();

  const weekProgress =
    habit.frequency_type === "daily"
      ? `${stats.completedThisWeek} / ${stats.targetThisWeek} this week`
      : `${stats.completedThisWeek} / ${stats.targetThisWeek} this ${habit.frequency_type === "weekly" ? "week" : "month"}`;

  return (
    <>
      <Card
        className={cn(
          "group relative hover:shadow-md transition-shadow",
          habit.is_archived && "opacity-60"
        )}
        style={{ borderTopColor: habit.color ?? undefined, borderTopWidth: 3 }}
      >
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <Link href={`/habits/${habit.id}`} className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xl shrink-0">{habit.icon ?? "🎯"}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate leading-snug">{habit.title}</h3>
              {habit.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {habit.description}
                </p>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil size={13} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => archiveHabit(habit.id)}>
                  <Archive size={13} className="mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteHabit(habit.id)}
                >
                  <Trash2 size={13} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3">
            {/* Progress ring + week label */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <HabitProgressRing
                  completed={stats.completedThisWeek}
                  target={stats.targetThisWeek}
                  size={44}
                  strokeWidth={4}
                />
                {/* Completion icon in center of ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {stats.isCompletedToday ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Circle size={12} className="text-muted-foreground" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{weekProgress}</p>
                <HabitStreakBadge streak={stats.currentStreak} className="mt-1" />
              </div>
            </div>

            {/* Check-in button */}
            {!habit.is_archived && (
              <Button
                size="sm"
                variant={stats.isCompletedToday ? "secondary" : "default"}
                className="shrink-0"
                onClick={() => setCheckInOpen(true)}
              >
                {stats.isCompletedToday ? "Log again" : "Check in"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <HabitCheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        habit={habit}
      />
      <HabitCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editHabit={habit}
      />
    </>
  );
}
