"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";

interface SectionInlineCreateProps {
  onSubmit: (name: string) => void;
}

export function SectionInlineCreate({ onSubmit }: SectionInlineCreateProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
    setValue("");
    setIsCreating(false);
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        setValue("");
        setIsCreating(false);
      }
    },
    [handleSubmit]
  );

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
    setValue("");
    setIsCreating(false);
  }, [value, onSubmit]);

  if (isCreating) {
    return (
      <div className="flex items-center gap-2 py-2 px-2 border-t border-dashed border-border/60">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Section name..."
          className="flex-1 min-w-0 text-sm font-semibold bg-background border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
          maxLength={100}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsCreating(true)}
      className="flex items-center gap-2 w-full py-2 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-dashed border-border/60"
    >
      <Plus className="h-4 w-4" />
      <span>Add section</span>
    </button>
  );
}
