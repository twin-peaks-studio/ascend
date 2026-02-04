"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_SORT_OPTIONS,
  getSortOptionKey,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";

interface TaskSortSelectProps {
  field: TaskSortField;
  direction: TaskSortDirection;
  onChange: (field: TaskSortField, direction: TaskSortDirection) => void;
}

export function TaskSortSelect({
  field,
  direction,
  onChange,
}: TaskSortSelectProps) {
  const currentValue = getSortOptionKey(field, direction);

  const handleChange = (value: string) => {
    const [newField, newDirection] = value.split(":") as [
      TaskSortField,
      TaskSortDirection
    ];
    onChange(newField, newDirection);
  };

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="h-8 gap-1.5 text-xs">
        <ArrowUpDown className="h-3.5 w-3.5" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent align="end">
        {TASK_SORT_OPTIONS.map((option) => (
          <SelectItem
            key={getSortOptionKey(option.field, option.direction)}
            value={getSortOptionKey(option.field, option.direction)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
