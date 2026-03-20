"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Focus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextEntryCard } from "./context-entry-card";
import {
  useTaskContextEntries,
  useTaskContextEntryMutations,
} from "@/hooks/use-task-context-entries";

interface TaskContextEntriesProps {
  taskId: string;
  /** Always show expanded (no collapse toggle). Used in focus view. */
  alwaysExpanded?: boolean;
  /** Hide the Focus link (when already in focus view). */
  hideFocusLink?: boolean;
}

export function TaskContextEntries({
  taskId,
  alwaysExpanded = false,
  hideFocusLink = false,
}: TaskContextEntriesProps) {
  const { entries, loading: entriesLoading } = useTaskContextEntries(taskId);
  const { createEntry, updateEntry, deleteEntry, loading: mutating } =
    useTaskContextEntryMutations();

  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newContent, setNewContent] = useState("");

  const handleAdd = useCallback(async () => {
    if (!newContent.trim()) return;
    const result = await createEntry(taskId, newContent);
    if (result) {
      setNewContent("");
      setShowNewEntry(false);
    }
  }, [newContent, taskId, createEntry]);

  const isExpanded = alwaysExpanded || expanded;

  // Auto-expand when entries exist
  if (entries.length > 0 && !expanded && !alwaysExpanded) {
    setExpanded(true);
  }

  return (
    <div className="mb-8">
      {/* Header */}
      {!alwaysExpanded && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <FileText className="h-4 w-4" />
            <span>
              Context & Findings{entries.length > 0 && ` (${entries.length})`}
            </span>
          </button>

          {isExpanded && (
            <div className="flex items-center gap-1 ml-auto">
              {!hideFocusLink && (
                <Link href={`/tasks/${taskId}/focus`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Focus className="h-3.5 w-3.5" />
                    Focus
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowNewEntry(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Always-expanded header (focus view) */}
      {alwaysExpanded && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              Context & Findings{entries.length > 0 && ` (${entries.length})`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowNewEntry(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* New entry form */}
          {showNewEntry && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Record a finding, decision, or context note..."
                rows={4}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleAdd();
                  }
                  if (e.key === "Escape") {
                    setShowNewEntry(false);
                    setNewContent("");
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {"\u2318"}+Enter to save
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewEntry(false);
                      setNewContent("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!newContent.trim() || mutating}
                  >
                    Add Entry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {entriesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 && !showNewEntry ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                No context & findings yet.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Record research notes, decisions, and discoveries as you work.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewEntry(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add your first entry
              </Button>
            </div>
          ) : (
            entries.map((entry) => (
              <ContextEntryCard
                key={entry.id}
                entry={entry}
                taskId={taskId}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
                mutating={mutating}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
