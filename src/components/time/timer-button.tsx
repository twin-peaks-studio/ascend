"use client";

/**
 * Timer Button Component
 *
 * A button to start/stop the timer for a specific entity (task, note, project).
 * Shows elapsed time when the timer is running for this entity.
 */

import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerContext } from "@/contexts/timer-context";
import type { TimeTrackingEntityType } from "@/types/database";
import { cn } from "@/lib/utils";

interface TimerButtonProps {
  entityType: TimeTrackingEntityType;
  entityId: string;
  entityName: string;
  /** Show text label alongside icon */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Additional class name */
  className?: string;
}

export function TimerButton({
  entityType,
  entityId,
  entityName,
  showLabel = true,
  size = "default",
  className,
}: TimerButtonProps) {
  const {
    activeTimer,
    isTimerRunning,
    formattedElapsedTime,
    startTimer,
    stopTimer,
    isMutating,
  } = useTimerContext();

  // Check if THIS entity has the active timer
  const isThisEntityRunning =
    isTimerRunning &&
    activeTimer?.entity_type === entityType &&
    activeTimer?.entity_id === entityId;

  // Another entity has an active timer
  const isOtherEntityRunning = isTimerRunning && !isThisEntityRunning;

  const handleClick = async () => {
    if (isThisEntityRunning) {
      await stopTimer();
    } else {
      await startTimer(entityType, entityId, entityName);
    }
  };

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (isThisEntityRunning) {
    // Timer is running for this entity - show stop button with elapsed time
    return (
      <Button
        variant="destructive"
        size={size}
        onClick={handleClick}
        disabled={isMutating}
        className={cn("gap-2", className)}
      >
        <Square className={cn(iconSize, "fill-current")} />
        {showLabel && (
          <span className="font-mono tabular-nums">{formattedElapsedTime}</span>
        )}
      </Button>
    );
  }

  // Timer not running for this entity - show start button
  return (
    <Button
      variant={isOtherEntityRunning ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      disabled={isMutating}
      className={cn("gap-2", className)}
      title={
        isOtherEntityRunning
          ? "Another timer is running. Click to start (will show alert)."
          : "Start timer"
      }
    >
      <Play className={cn(iconSize, "fill-current")} />
      {showLabel && <span>Start Timer</span>}
    </Button>
  );
}
