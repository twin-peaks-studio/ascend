"use client";

/**
 * Time Report By Day View
 *
 * Shows time entries grouped by day with expandable task breakdowns.
 * Days are sorted in reverse chronological order.
 */

import { TimeReportDayGroup } from "./time-report-day-group";
import type { DayTimeData } from "@/hooks/use-project-time-report";

interface TimeReportByDayProps {
  days: DayTimeData[];
  onTaskClick?: (taskId: string) => void;
}

export function TimeReportByDay({ days, onTaskClick }: TimeReportByDayProps) {
  if (days.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No time tracked yet
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {days.map((day, index) => (
        <TimeReportDayGroup
          key={day.date}
          date={day.date}
          totalSeconds={day.totalSeconds}
          tasks={day.tasks}
          defaultExpanded={index < 2} // Auto-expand first 2 days
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}
