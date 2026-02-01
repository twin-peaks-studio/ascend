"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Show 12 months for scrolling (6 before, current, 5 after)
  const numberOfMonths = 12;

  // Calculate date range - start 6 months ago to allow past date selection
  const { startMonth, endMonth, defaultMonth } = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startMonth: start, endMonth: end, defaultMonth: current };
  }, []);

  // Ref for scrolling to current month on mount
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to approximately the middle (current month) on mount
    if (scrollRef.current) {
      const scrollHeight = scrollRef.current.scrollHeight;
      const clientHeight = scrollRef.current.clientHeight;
      // Scroll to roughly 50% (where current month should be)
      scrollRef.current.scrollTop = (scrollHeight - clientHeight) / 2;
    }
  }, []);

  // Handle wheel events explicitly to ensure scrolling works in popovers
  const handleWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight;

    // Only prevent default if we can scroll in that direction
    if ((e.deltaY < 0 && !isAtTop) || (e.deltaY > 0 && !isAtBottom)) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      className="max-h-[280px] overflow-y-scroll overscroll-contain"
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        scrollbarWidth: 'thin',
      }}
    >
      <DayPicker
        showOutsideDays={showOutsideDays}
        numberOfMonths={numberOfMonths}
        defaultMonth={defaultMonth}
        startMonth={startMonth}
        endMonth={endMonth}
        hideNavigation
        className={cn("p-2", className)}
        classNames={{
          months: "flex flex-col",
          month: "",
          month_caption: "flex justify-start pt-3 pb-1 items-center",
          caption_label: "text-xs font-semibold",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday:
            "text-muted-foreground rounded-md w-6 font-normal text-[0.65rem]",
          week: "flex w-full",
          day: cn(
            "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
            props.mode === "range"
              ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
              : "[&:has([aria-selected])]:rounded-md"
          ),
          day_button: cn(
            buttonVariants({ variant: "ghost" }),
            "h-6 w-6 p-0 font-normal text-xs aria-selected:opacity-100"
          ),
          range_start: "day-range-start",
          range_end: "day-range-end",
          selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          today: "bg-accent text-accent-foreground",
          outside:
            "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          disabled: "text-muted-foreground opacity-50",
          range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          hidden: "invisible",
          ...classNames,
        }}
        {...props}
      />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
