"use client";

/**
 * Time Entry List Component
 *
 * Displays a list of time entries for an entity.
 * Allows editing and deleting entries.
 */

import { useState } from "react";
import { format } from "date-fns";
import { Clock, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { TimeEntryDialog } from "./time-entry-dialog";
import { useTimeTracking, formatDuration } from "@/hooks/use-time-tracking";
import type { TimeEntry, TimeTrackingEntityType } from "@/types/database";
import { cn } from "@/lib/utils";

interface TimeEntryListProps {
  entityType: TimeTrackingEntityType;
  entityId: string;
  /** Whether the list starts collapsed */
  defaultCollapsed?: boolean;
  /** Hide the header (when embedded in a parent that already has a label) */
  hideHeader?: boolean;
  /** Additional class name */
  className?: string;
}

export function TimeEntryList({
  entityType,
  entityId,
  defaultCollapsed = true,
  hideHeader = false,
  className,
}: TimeEntryListProps) {
  const {
    entries,
    totalTime,
    formattedTotalTime,
    loading,
    updateEntry,
    deleteEntry,
    isUpdating,
    isDeleting,
  } = useTimeTracking(entityType, entityId);

  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  // Filter to only show completed entries (with end_time)
  const completedEntries = entries.filter((e) => e.end_time !== null);

  if (loading) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Loading time entries...
      </div>
    );
  }

  const handleSaveEntry = async (data: {
    start_time: string;
    end_time: string;
    description?: string;
  }) => {
    if (!editingEntry) return;
    await updateEntry(editingEntry.id, data);
    setEditingEntry(null);
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntryId) return;
    await deleteEntry(deletingEntryId);
    setDeletingEntryId(null);
  };

  // When header is hidden, always show expanded
  const showEntries = hideHeader || isExpanded;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with total time - only show if not hidden */}
      {!hideHeader && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Clock className="h-4 w-4" />
          <span>Time Tracked</span>
          {totalTime > 0 && (
            <span className="ml-auto font-mono tabular-nums text-foreground">
              {formattedTotalTime}
            </span>
          )}
          {completedEntries.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({completedEntries.length} {completedEntries.length === 1 ? "entry" : "entries"})
            </span>
          )}
        </button>
      )}

      {/* Entry list */}
      {showEntries && (
        <div className={cn("space-y-1", !hideHeader && "pl-6")}>
          {completedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No time entries yet. Start the timer to begin tracking.
            </p>
          ) : (
            completedEntries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                onEdit={() => setEditingEntry(entry)}
                onDelete={() => setDeletingEntryId(entry.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Edit dialog */}
      <TimeEntryDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
        onSave={handleSaveEntry}
        loading={isUpdating}
      />

      {/* Delete confirmation */}
      <DeleteConfirmationDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Time Entry"
        description="Are you sure you want to delete this time entry? This action cannot be undone."
      />
    </div>
  );
}

interface TimeEntryRowProps {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}

function TimeEntryRow({ entry, onEdit, onDelete }: TimeEntryRowProps) {
  const startDate = new Date(entry.start_time);
  const endDate = entry.end_time ? new Date(entry.end_time) : null;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {format(startDate, "MMM d")}
          </span>
          <span>
            {format(startDate, "h:mm a")}
            {endDate && (
              <>
                <span className="text-muted-foreground mx-1">→</span>
                {format(endDate, "h:mm a")}
              </>
            )}
          </span>
        </div>
        {entry.description && (
          <p className="text-xs text-muted-foreground truncate">
            {entry.description}
          </p>
        )}
      </div>
      <span className="font-mono tabular-nums text-sm">
        {entry.duration ? formatDuration(entry.duration) : "--:--"}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          title="Edit entry"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete entry"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
