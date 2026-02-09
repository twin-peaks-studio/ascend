"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  /** The current date value (time will be read from/applied to this) */
  value: Date | null | undefined;
  /** Called when time changes. Receives updated Date with new time applied. */
  onChange: (date: Date) => void;
  className?: string;
}

/**
 * Compact time picker with hour and minute selects.
 * Designed to sit below a Calendar in a Popover.
 */
export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const now = new Date();
  const hours = value ? value.getHours() : now.getHours();
  const minutes = value ? value.getMinutes() : Math.floor(now.getMinutes() / 5) * 5;

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const date = value ? new Date(value) : new Date();
    date.setHours(parseInt(e.target.value, 10));
    date.setMinutes(minutes);
    date.setSeconds(0, 0);
    onChange(date);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const date = value ? new Date(value) : new Date();
    date.setHours(hours);
    date.setMinutes(parseInt(e.target.value, 10));
    date.setSeconds(0, 0);
    onChange(date);
  };

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <select
        value={hours}
        onChange={handleHourChange}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">:</span>
      <select
        value={minutes}
        onChange={handleMinuteChange}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground ml-1">
        {hours < 12 ? "AM" : "PM"}
      </span>
    </div>
  );
}
