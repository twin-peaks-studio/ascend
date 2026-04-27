"use client";

import { useState, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Clock, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { useHabitEntryMutations } from "@/hooks/use-habit-entries";
import { cn } from "@/lib/utils";
import type { HabitEntry, Habit } from "@/types";

interface HabitEntryCardProps {
  entry: HabitEntry;
  habit: Habit;
  showDate?: boolean;
}

export function HabitEntryCard({ entry, habit, showDate = true }: HabitEntryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");
  const [editDuration, setEditDuration] = useState(
    entry.duration_minutes?.toString() ?? ""
  );
  const { updateEntry, deleteEntry, loading } = useHabitEntryMutations();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = useCallback(async () => {
    await updateEntry(entry.id, habit.id, {
      notes: editNotes || null,
      duration_minutes: editDuration ? parseInt(editDuration, 10) : null,
    });
    setIsEditing(false);
  }, [updateEntry, entry.id, habit.id, editNotes, editDuration]);

  const handleDelete = useCallback(async () => {
    await deleteEntry(entry.id, habit.id, entry.entry_date);
  }, [deleteEntry, entry.id, habit.id, entry.entry_date]);

  const date = parseISO(entry.entry_date);
  const time = format(parseISO(entry.checked_in_at), "h:mm a");

  return (
    <div className={cn("group relative py-4 first:pt-0", isEditing && "bg-muted/30 rounded-lg px-3 -mx-3")}>
      {/* Date + metadata row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {showDate && (
            <span className="text-sm font-semibold">
              {format(date, "EEEE, MMMM d")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{time}</span>
          {(isEditing ? editDuration : entry.duration_minutes) && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              <Clock size={10} />
              {isEditing ? editDuration : entry.duration_minutes} min
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isEditing ? (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={loading}>
                <Check size={13} className="text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditing(false)}>
                <X size={13} />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                <Pencil size={13} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode: duration + notes */}
      {isEditing && (
        <div className="space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="1440"
              placeholder="Duration"
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
              className="w-24 h-7 text-sm"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
        </div>
      )}

      {/* Notes content */}
      {isEditing ? (
        <div className="rounded-md border bg-background overflow-hidden">
          <RichTextEditor
            value={editNotes}
            onChange={setEditNotes}
            placeholder="Notes from this session..."
            minHeight={100}
            autoFocus
            workspaceId={habit.workspace_id}
          />
        </div>
      ) : entry.notes ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
          dangerouslySetInnerHTML={{ __html: entry.notes }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors italic"
        >
          No notes — click to add
        </button>
      )}
    </div>
  );
}
