"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleDot, X, Circle, Clock, CheckCircle2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; Icon: LucideIcon }> = [
  { value: "todo", label: "To Do", Icon: Circle },
  { value: "in-progress", label: "In Progress", Icon: Clock },
  { value: "done", label: "Done", Icon: CheckCircle2 },
];

interface StatusFilterProps {
  selectedStatuses: TaskStatus[];
  onStatusesChange: (statuses: TaskStatus[]) => void;
}

export function StatusFilter({ selectedStatuses, onStatusesChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false);

  const toggle = (status: TaskStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  const hasFilter = selectedStatuses.length > 0;

  const label = hasFilter
    ? selectedStatuses.length === 1
      ? STATUS_OPTIONS.find((o) => o.value === selectedStatuses[0])?.label ?? "Status"
      : `${selectedStatuses.length} statuses`
    : "Status";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs",
            hasFilter && "bg-primary/10 border-primary/30"
          )}
        >
          <CircleDot className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        <div className="space-y-1">
          {hasFilter && (
            <button
              onClick={() => onStatusesChange([])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filter
            </button>
          )}
          {STATUS_OPTIONS.map(({ value, label: optLabel, Icon }) => {
            const isSelected = selectedStatuses.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggle(value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{optLabel}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
