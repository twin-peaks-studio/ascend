"use client";

import { useMemo } from "react";
import { format, startOfWeek, parseISO, getDay } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/types";

interface HabitCalendarHeatmapProps {
  calendarData: CalendarDay[];
  onCellClick?: (date: string) => void;
  className?: string;
}

const STATUS_CLASSES: Record<CalendarDay["status"], string> = {
  completed: "bg-green-500 dark:bg-green-600",
  partial: "bg-amber-400 dark:bg-amber-500",
  missed: "bg-muted-foreground/20 dark:bg-muted-foreground/15",
  future: "bg-muted/30",
  today: "bg-muted ring-2 ring-primary ring-offset-1",
};

const DAY_LABELS = ["Mon", "Wed", "Fri"];
const DAY_INDICES = [0, 2, 4]; // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4 (in Mon-based week)

function buildGrid(calendarData: CalendarDay[]) {
  // Group by ISO week (Mon-start)
  const weekMap = new Map<string, CalendarDay[]>();

  for (const day of calendarData) {
    const date = parseISO(day.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const key = format(weekStart, "yyyy-MM-dd");
    if (!weekMap.has(key)) weekMap.set(key, []);
    // Day-of-week index: Mon=0 … Sun=6
    const dow = (getDay(date) + 6) % 7;
    const slot = weekMap.get(key)!;
    slot[dow] = day;
  }

  const sortedWeeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, days]) => days);

  // Month labels: for each week column, find which month starts there
  const monthLabels: Array<{ weekIdx: number; label: string }> = [];
  let lastMonth = "";
  for (let i = 0; i < sortedWeeks.length; i++) {
    const firstDay = sortedWeeks[i].find((d) => d);
    if (firstDay) {
      const m = format(parseISO(firstDay.date), "MMM");
      if (m !== lastMonth) {
        monthLabels.push({ weekIdx: i, label: m });
        lastMonth = m;
      }
    }
  }

  return { sortedWeeks, monthLabels };
}

function CellTooltip({
  day,
  children,
}: {
  day: CalendarDay;
  children: React.ReactNode;
}) {
  const date = parseISO(day.date);
  const label = format(date, "EEEE, MMM d, yyyy");

  let statusText = "";
  if (day.status === "completed") {
    statusText = `✓ Completed${day.durationMinutes ? ` · ${day.durationMinutes} min` : ""}`;
  } else if (day.status === "partial") {
    statusText = `Partial (${day.durationMinutes} min logged)`;
  } else if (day.status === "missed") {
    statusText = "Missed";
  } else if (day.status === "today") {
    statusText = "Today — not yet done";
  } else {
    statusText = "Future";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{statusText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function HabitCalendarHeatmap({
  calendarData,
  onCellClick,
  className,
}: HabitCalendarHeatmapProps) {
  const { sortedWeeks, monthLabels } = useMemo(() => buildGrid(calendarData), [calendarData]);

  if (sortedWeeks.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        No data yet. Start checking in to see your calendar.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("overflow-x-auto", className)}>
        <div className="inline-flex flex-col gap-1 min-w-0">
          {/* Month labels */}
          <div className="flex gap-[3px] ml-8">
            {sortedWeeks.map((_, weekIdx) => {
              const label = monthLabels.find((m) => m.weekIdx === weekIdx);
              return (
                <div key={weekIdx} className="w-[14px] text-[10px] text-muted-foreground">
                  {label?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* Grid: 7 rows (Mon–Sun), N columns (weeks) */}
          <div className="flex gap-[3px]">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[3px] mr-1">
              {Array.from({ length: 7 }, (_, i) => {
                const label = i === 0 ? "Mon" : i === 2 ? "Wed" : i === 4 ? "Fri" : "";
                return (
                  <div
                    key={i}
                    className="h-[14px] w-6 text-[9px] text-muted-foreground flex items-center"
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Week columns */}
            {sortedWeeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, dow) => {
                  const day = week[dow];
                  if (!day) {
                    return <div key={dow} className="w-[14px] h-[14px]" />;
                  }

                  const isPast = day.status === "missed" || day.status === "completed" || day.status === "partial";
                  const isClickable = onCellClick && (isPast || day.status === "today");

                  return (
                    <CellTooltip key={dow} day={day}>
                      <button
                        type="button"
                        onClick={isClickable ? () => onCellClick!(day.date) : undefined}
                        className={cn(
                          "w-[14px] h-[14px] rounded-[3px] transition-all",
                          STATUS_CLASSES[day.status],
                          isClickable && "hover:ring-2 hover:ring-primary/60 cursor-pointer",
                          !isClickable && "cursor-default"
                        )}
                        aria-label={`${day.date}: ${day.status}`}
                      />
                    </CellTooltip>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 ml-8">
            <span className="text-[10px] text-muted-foreground">Less</span>
            {(["missed", "partial", "completed"] as const).map((s) => (
              <div key={s} className={cn("w-[14px] h-[14px] rounded-[3px]", STATUS_CLASSES[s])} />
            ))}
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
