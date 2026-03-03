"use client";

import { useState } from "react";
import { addDays, nextSaturday, isWeekend, format } from "date-fns";
import { CalendarClock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

interface ReschedulePopoverProps {
  onReschedule: (newDate: Date) => void;
  disabled?: boolean;
}

export function ReschedulePopover({ onReschedule, disabled }: ReschedulePopoverProps) {
  const [open, setOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined);

  const today = new Date();

  // Quick chip options
  const tomorrow = addDays(today, 1);
  const weekend = isWeekend(today) ? addDays(today, (8 - today.getDay()) % 7 || 7) : nextSaturday(today);
  const nextWeek = addDays(today, 7);

  const chips = [
    { label: "Tomorrow", date: tomorrow, sub: format(tomorrow, "EEE, MMM d") },
    { label: "This Weekend", date: weekend, sub: format(weekend, "EEE, MMM d") },
    { label: "Next Week", date: nextWeek, sub: format(nextWeek, "EEE, MMM d") },
  ];

  const handleChipClick = (date: Date) => {
    onReschedule(date);
    setOpen(false);
    setShowDatePicker(false);
  };

  const handlePickerChange = (date: Date | null | undefined) => {
    setPickerDate(date ?? undefined);
    if (date) {
      onReschedule(date);
      setOpen(false);
      setShowDatePicker(false);
      setPickerDate(undefined);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setShowDatePicker(false); setPickerDate(undefined); } }}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          title="Reschedule"
        >
          <CalendarClock className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        {!showDatePicker ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Reschedule to</p>
            {chips.map(({ label, date, sub }) => (
              <button
                key={label}
                onClick={() => handleChipClick(date)}
                className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
              </button>
            ))}
            <div className="border-t pt-1 mt-1">
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Pick a date
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => { setShowDatePicker(false); setPickerDate(undefined); }}
              >
                ← Back
              </Button>
              <span className="text-xs font-medium text-muted-foreground">Pick a date</span>
            </div>
            <DatePicker
              value={pickerDate}
              onChange={handlePickerChange}
              placeholder="Select date"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
