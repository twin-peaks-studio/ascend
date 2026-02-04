"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface NoteListItemProps {
  note: Note;
  onClick: () => void;
}

/**
 * Note list item for displaying in the project page collapsible section
 */
export function NoteListItem({ note, onClick }: NoteListItemProps) {
  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Get a preview of the content (first line or truncated)
  const getContentPreview = (content: string | null) => {
    if (!content) return null;
    // Strip HTML tags for preview (TipTap stores HTML)
    const textOnly = content
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Replace HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim();
    if (!textOnly) return null;
    return textOnly.length > 80 ? textOnly.substring(0, 80) + "..." : textOnly;
  };

  const contentPreview = getContentPreview(note.content);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 w-full p-3 rounded-lg text-left transition-colors",
        "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium truncate">{note.title}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(note.updated_at)}
          </span>
        </div>
        {contentPreview && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {contentPreview}
          </p>
        )}
      </div>
    </button>
  );
}
