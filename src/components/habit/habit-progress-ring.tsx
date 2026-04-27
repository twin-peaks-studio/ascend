"use client";

import { cn } from "@/lib/utils";

interface HabitProgressRingProps {
  completed: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export function HabitProgressRing({
  completed,
  target,
  size = 48,
  strokeWidth = 4,
  className,
  color,
}: HabitProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(completed / target, 1) : 0;
  const offset = circumference * (1 - progress);

  const ringColor =
    color ??
    (progress >= 1
      ? "stroke-green-500"
      : progress >= 0.5
      ? "stroke-primary"
      : "stroke-amber-500");

  return (
    <svg
      width={size}
      height={size}
      className={cn("rotate-[-90deg]", className)}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn("transition-all duration-500", ringColor)}
      />
    </svg>
  );
}
