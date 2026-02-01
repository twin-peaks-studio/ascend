"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAddNoteTaskProps {
  onSubmit: (title: string) => Promise<void>;
  loading?: boolean;
  placeholder?: string;
}

/**
 * Inline form for quickly adding a task from within a note
 */
export function QuickAddNoteTask({
  onSubmit,
  loading = false,
  placeholder = "Add a task...",
}: QuickAddNoteTaskProps) {
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = async () => {
    if (!title.trim() || loading) return;

    const taskTitle = title.trim();
    setTitle("");
    await onSubmit(taskTitle);

    // Keep focus on input for rapid task entry
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && title.trim()) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setTitle("");
      setIsExpanded(false);
    }
  };

  const handleBlur = () => {
    // Only collapse if the input is empty
    if (!title.trim()) {
      setIsExpanded(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground",
          "rounded-lg border border-dashed border-border/50",
          "hover:border-border hover:text-foreground hover:bg-muted/30",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Plus className="h-4 w-4" />
        <span>{placeholder}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex-1"
        maxLength={200}
        disabled={loading}
      />
      <Button
        type="button"
        size="icon"
        onClick={handleSubmit}
        disabled={!title.trim() || loading}
        className="shrink-0"
      >
        {loading ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
