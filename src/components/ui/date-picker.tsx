"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingDate, setPendingDate] = React.useState<Date | null | undefined>(value);

  // Sync pending when value changes externally (while popover is closed)
  const prevValueRef = React.useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    if (!open) setPendingDate(value);
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Seed pending from committed value on open
      setPendingDate(value);
    }
    setOpen(nextOpen);
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      setPendingDate(null);
      return;
    }
    // Preserve existing time; default to current time on first pick
    const source = pendingDate ?? value;
    if (source) {
      date.setHours(source.getHours(), source.getMinutes(), 0, 0);
    } else {
      const now = new Date();
      date.setHours(now.getHours(), Math.floor(now.getMinutes() / 5) * 5, 0, 0);
    }
    setPendingDate(date);
  };

  const handleTimeChange = (date: Date) => {
    setPendingDate(date);
  };

  const handleSave = () => {
    onChange(pendingDate ?? null);
    setOpen(false);
  };

  const handleClear = () => {
    setPendingDate(null);
    onChange(null);
    setOpen(false);
  };

  const handleDiscard = () => {
    setPendingDate(value);
    setOpen(false);
  };

  const formatDisplay = (date: Date) => {
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    return hasTime ? format(date, "PPP 'at' h:mm a") : format(date, "PPP");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDisplay(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onEscapeKeyDown={handleDiscard}
        onInteractOutside={handleDiscard}
      >
        <Calendar
          mode="single"
          selected={pendingDate || undefined}
          onSelect={handleSelect}
          initialFocus
          calendarFooter={
            <>
              <div className="border-t" />
              <TimePicker value={pendingDate} onChange={handleTimeChange} />
              <div className="flex gap-2 p-2 border-t">
                {pendingDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-muted-foreground"
                    onClick={handleClear}
                  >
                    Clear
                  </Button>
                )}
                <Button size="sm" className="flex-1" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
