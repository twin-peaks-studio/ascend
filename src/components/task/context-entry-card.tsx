"use client";

import { useState } from "react";
import { Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskContextEntry } from "@/types/database";

interface ContextEntryCardProps {
  entry: TaskContextEntry;
  taskId: string;
  onUpdate: (id: string, taskId: string, content: string) => Promise<boolean>;
  onDelete: (id: string, taskId: string) => Promise<boolean>;
  mutating: boolean;
}

export function ContextEntryCard({ entry, taskId, onUpdate, onDelete, mutating }: ContextEntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    const success = await onUpdate(entry.id, taskId, editContent.trim());
    if (success) setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setEditContent(entry.content);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editContent.trim() || mutating}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1">{entry.content}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(entry.id, taskId)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {entry.updated_at !== entry.created_at && " (edited)"}
          </p>
        </>
      )}
    </div>
  );
}
