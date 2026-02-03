"use client";

/**
 * Global Timer Indicator Component
 *
 * Shows in the header when a timer is running.
 * Displays the entity name and elapsed time.
 * Click navigates to the task being tracked.
 */

import { useRouter } from "next/navigation";
import { Clock, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerContext } from "@/contexts/timer-context";
import { cn } from "@/lib/utils";

interface GlobalTimerIndicatorProps {
  className?: string;
}

export function GlobalTimerIndicator({ className }: GlobalTimerIndicatorProps) {
  const router = useRouter();
  const {
    activeTimer,
    activeTimerState,
    isTimerRunning,
    formattedElapsedTime,
    stopTimer,
    isMutating,
    onOpenTask,
  } = useTimerContext();

  if (!isTimerRunning || !activeTimer) {
    return null;
  }

  const entityName = activeTimerState?.entityName || "Timer";

  const handleClick = () => {
    if (activeTimer.entity_type === "task") {
      // Open the task details dialog (stays on current page)
      onOpenTask(activeTimer.entity_id);
    } else if (activeTimer.entity_type === "project") {
      router.push(`/projects/${activeTimer.entity_id}`);
    } else if (activeTimer.entity_type === "note") {
      // Notes need project context, which we don't have here
      router.push("/projects");
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await stopTimer();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full cursor-pointer hover:bg-primary/20 transition-colors",
        className
      )}
      onClick={handleClick}
      title={`Timer running: ${entityName}`}
    >
      <Clock className="h-4 w-4 text-primary animate-pulse" />
      <span className="text-sm font-medium text-primary max-w-[120px] truncate">
        {entityName}
      </span>
      <span className="text-sm font-mono tabular-nums text-primary">
        {formattedElapsedTime}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
        onClick={handleStop}
        disabled={isMutating}
        title="Stop timer"
      >
        <Square className="h-3 w-3 fill-current" />
      </Button>
    </div>
  );
}
