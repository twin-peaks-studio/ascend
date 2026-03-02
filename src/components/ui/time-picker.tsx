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
 * Compact time picker with 12-hour hour/minute selects and AM/PM toggle.
 * Designed to sit below a Calendar in a Popover.
 */
export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const now = new Date();
  const hours = value ? value.getHours() : now.getHours();
  const minutes = value ? value.getMinutes() : Math.floor(now.getMinutes() / 5) * 5;

  const isPM = hours >= 12;
  const displayHour = hours % 12 || 12;

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const h = parseInt(e.target.value, 10);
    const newHours = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    const date = value ? new Date(value) : new Date();
    date.setHours(newHours);
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

  const handleAmPmToggle = () => {
    const date = value ? new Date(value) : new Date();
    const newHours = isPM ? hours - 12 : hours + 12;
    date.setHours(newHours);
    date.setMinutes(minutes);
    date.setSeconds(0, 0);
    onChange(date);
  };

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <select
        value={displayHour}
        onChange={handleHourChange}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h.toString().padStart(2, "0")}
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
      <button
        type="button"
        onClick={handleAmPmToggle}
        className="h-7 min-w-[2.5rem] rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ml-1"
      >
        {isPM ? "PM" : "AM"}
      </button>
    </div>
  );
}
