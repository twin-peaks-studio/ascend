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
import { ContextEntryCard, type ContextEntry } from "./context-entry-card";

/**
 * Local-state prototype for task context entries.
 * No database calls — entries live in React state only.
 */

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
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newContent, setNewContent] = useState("");

  const handleAdd = useCallback(() => {
    if (!newContent.trim()) return;
    const now = new Date().toISOString();
    const entry: ContextEntry = {
      id: crypto.randomUUID(),
      content: newContent.trim(),
      created_at: now,
      updated_at: now,
    };
    setEntries((prev) => [entry, ...prev]);
    setNewContent("");
    setShowNewEntry(false);
  }, [newContent]);

  const handleUpdate = useCallback((id: string, content: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, content, updated_at: new Date().toISOString() } : e
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const isExpanded = alwaysExpanded || expanded;

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
                    disabled={!newContent.trim()}
                  >
                    Add Entry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Entries list */}
          {entries.length === 0 && !showNewEntry ? (
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
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
