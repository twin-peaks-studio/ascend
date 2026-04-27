"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface HabitStreakBadgeProps {
  streak: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function HabitStreakBadge({ streak, className, size = "sm" }: HabitStreakBadgeProps) {
  if (streak === 0) return null;

  const sizeClasses = {
    sm: "text-xs gap-0.5 px-1.5 py-0.5",
    md: "text-sm gap-1 px-2 py-1",
    lg: "text-base gap-1 px-3 py-1.5",
  };

  const iconSize = { sm: 10, md: 12, lg: 16 };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        streak >= 30
          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
          : streak >= 7
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-muted text-muted-foreground",
        sizeClasses[size],
        className
      )}
    >
      <Flame
        size={iconSize[size]}
        className={
          streak >= 7
            ? "fill-current"
            : "fill-none"
        }
      />
      {streak}
    </span>
  );
}
