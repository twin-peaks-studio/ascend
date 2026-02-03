"use client";

/**
 * Time Entry Dialog Component
 *
 * Dialog for editing a time entry's start time, end time, and description.
 * Auto-calculates duration when times are changed.
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/hooks/use-time-tracking";
import type { TimeEntry } from "@/types/database";

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeEntry | null;
  onSave: (data: {
    start_time: string;
    end_time: string;
    description?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function TimeEntryDialog({
  open,
  onOpenChange,
  entry,
  onSave,
  loading = false,
}: TimeEntryDialogProps) {
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      const start = new Date(entry.start_time);
      setStartDate(format(start, "yyyy-MM-dd"));
      setStartTime(format(start, "HH:mm"));

      if (entry.end_time) {
        const end = new Date(entry.end_time);
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
      }

      setDescription(entry.description || "");
      setError(null);
    }
  }, [entry]);

  // Calculate duration for display
  const calculatedDuration = (() => {
    if (!startDate || !startTime || !endDate || !endTime) return null;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) return null;
    return Math.floor(diffMs / 1000);
  })();

  const handleSave = async () => {
    setError(null);

    if (!startDate || !startTime || !endDate || !endTime) {
      setError("All date and time fields are required");
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      setError("End time must be after start time");
      return;
    }

    await onSave({
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Start time */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          {/* End time */}
          <div className="space-y-2">
            <Label>End Time</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          {/* Duration display */}
          {calculatedDuration !== null && (
            <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="font-mono tabular-nums font-medium">
                {formatDuration(calculatedDuration)}
              </span>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What were you working on?"
              rows={2}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
