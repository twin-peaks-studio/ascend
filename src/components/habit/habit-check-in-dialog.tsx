"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { useHabitEntryMutations } from "@/hooks/use-habit-entries";
import { cn } from "@/lib/utils";
import type { Habit, HabitEntry } from "@/types";

interface HabitCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit;
  prefillDate?: Date;
  editEntry?: HabitEntry;
  onSuccess?: (entry: HabitEntry) => void;
}

export function HabitCheckInDialog({
  open,
  onOpenChange,
  habit,
  prefillDate,
  editEntry,
  onSuccess,
}: HabitCheckInDialogProps) {
  const { createEntry, updateEntry, loading } = useHabitEntryMutations();
  const today = new Date();

  const [date, setDate] = useState<Date>(prefillDate ?? today);
  const [durationInput, setDurationInput] = useState(
    editEntry?.duration_minutes?.toString() ?? ""
  );
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isEditing = !!editEntry;
  const hasTimeGoal = habit.time_goal_minutes != null;

  const handleSubmit = async () => {
    const dateStr = format(date, "yyyy-MM-dd");
    const durationMinutes = durationInput ? parseInt(durationInput, 10) : null;

    if (isEditing && editEntry) {
      const updated = await updateEntry(editEntry.id, habit.id, {
        entry_date: dateStr,
        duration_minutes: durationMinutes,
        notes: notes || null,
      });
      if (updated) {
        onSuccess?.(updated);
        onOpenChange(false);
      }
    } else {
      const created = await createEntry({
        habit_id: habit.id,
        entry_date: dateStr,
        checked_in_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
        notes: notes || null,
      });
      if (created) {
        onSuccess?.(created);
        onOpenChange(false);
        // Reset for next use
        setDate(today);
        setDurationInput("");
        setNotes("");
      }
    }
  };

  const isDateFuture = date > today;
  const canSubmit =
    !isDateFuture &&
    (!hasTimeGoal || (durationInput !== "" && parseInt(durationInput, 10) > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-500" />
            {isEditing ? "Edit entry" : `Check in — ${habit.title}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    isDateFuture && "border-destructive"
                  )}
                >
                  <CalendarIcon size={14} className="mr-2 text-muted-foreground" />
                  {format(date, "EEEE, MMMM d, yyyy")}
                  {format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") && (
                    <span className="ml-2 text-xs text-muted-foreground">(today)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(d) => d > today}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {isDateFuture && (
              <p className="text-xs text-destructive">Cannot check in for a future date</p>
            )}
          </div>

          {/* Time logged */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Clock size={13} />
              Time logged
              {hasTimeGoal && (
                <span className="text-muted-foreground font-normal">
                  (goal: {habit.time_goal_minutes} min)
                </span>
              )}
              {!hasTimeGoal && (
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="1440"
                placeholder="0"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
              {durationInput && habit.time_goal_minutes && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    parseInt(durationInput) >= habit.time_goal_minutes
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {parseInt(durationInput) >= habit.time_goal_minutes ? "✓ goal met" : "below goal"}
                </span>
              )}
            </div>
          </div>

          {/* Notes / journal */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <div className="rounded-md border bg-background overflow-hidden">
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="What did you do? Key takeaways, observations..."
                minHeight={120}
                workspaceId={habit.workspace_id}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading ? "Saving..." : isEditing ? "Save changes" : "Log check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
