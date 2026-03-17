"use client";

/**
 * Entity Mention Suggestion List
 *
 * Dropdown component for the Tiptap #mention extension.
 * Shows matching entities filtered by name/slug with type icons.
 * Keyboard navigable (↑↓ Enter Esc).
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Package, Lightbulb, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/types/database";

const entityTypeConfig: Record<
  EntityType,
  { icon: typeof Package; label: string; color: string; bgColor: string }
> = {
  product: { icon: Package, label: "Product", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/40" },
  initiative: { icon: Lightbulb, label: "Initiative", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40" },
  stakeholder: { icon: Users, label: "Stakeholder", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/40" },
};

export interface EntitySuggestionItem {
  id: string;
  name: string;
  slug: string;
  entity_type: EntityType;
}

interface MentionSuggestionListProps {
  items: EntitySuggestionItem[];
  command: (item: EntitySuggestionItem) => void;
}

export interface MentionSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestionList = forwardRef<
  MentionSuggestionListRef,
  MentionSuggestionListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (items[selectedIndex]) {
          command(items[selectedIndex]);
        }
        return true;
      }

      if (event.key === "Escape") {
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
        <p className="text-sm text-muted-foreground">No entities found</p>
      </div>
    );
  }

  return (
    <div className="z-50 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      {items.map((item, index) => {
        const config = entityTypeConfig[item.entity_type];
        const Icon = config.icon;

        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
              "hover:bg-accent hover:text-accent-foreground",
              index === selectedIndex && "bg-accent text-accent-foreground"
            )}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Icon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
            <span className="truncate font-medium">{item.name}</span>
            <span className={cn("ml-auto text-xs shrink-0", config.color)}>
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});

MentionSuggestionList.displayName = "MentionSuggestionList";
