"use client";

/**
 * Mention Autocomplete Component
 *
 * Provides @mention autocomplete functionality in text inputs.
 * Shows a dropdown of matching users when @ is typed.
 * Supports keyboard navigation and click selection.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";

interface MentionAutocompleteProps {
  /**
   * The current text value
   */
  value: string;

  /**
   * Available user profiles to mention
   */
  profiles: Profile[];

  /**
   * Callback when a mention is selected
   * Receives the full text with the mention inserted
   */
  onSelect: (newText: string, cursorPosition: number) => void;

  /**
   * Current cursor position in the text
   */
  cursorPosition: number;

  /**
   * Optional className for positioning
   */
  className?: string;
}

/**
 * Get the mention query at the cursor position
 * Returns null if not in a mention, or the query string after @
 */
function getMentionQuery(text: string, cursorPos: number): { query: string; start: number } | null {
  // Find the last @ before cursor
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) return null;

  // Check if there's whitespace between @ and cursor
  const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
  if (/\s/.test(textAfterAt)) return null;

  // Check that @ is preceded by whitespace or start of string
  if (lastAtIndex > 0 && !/\s/.test(text[lastAtIndex - 1])) return null;

  return {
    query: textAfterAt,
    start: lastAtIndex,
  };
}

/**
 * Filter profiles based on mention query
 */
function filterProfiles(profiles: Profile[], query: string): Profile[] {
  if (!query) return profiles;

  const lowerQuery = query.toLowerCase();
  return profiles.filter((profile) => {
    // Match against display name
    if (profile.display_name?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Match against email username
    if (profile.email) {
      const emailUsername = profile.email.split("@")[0].toLowerCase();
      if (emailUsername.includes(lowerQuery)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Get initials from display name for avatar fallback
 */
function getInitials(displayName: string | null): string {
  if (!displayName) return "?";

  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

export function MentionAutocomplete({
  value,
  profiles,
  onSelect,
  cursorPosition,
  className,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Get current mention query
  const mentionQuery = getMentionQuery(value, cursorPosition);

  // Filter profiles based on query
  const filteredProfiles = mentionQuery
    ? filterProfiles(profiles, mentionQuery.query)
    : [];

  const isOpen = mentionQuery !== null && filteredProfiles.length > 0;

  // Reset selected index when query changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [mentionQuery?.query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  // Handle mention selection
  const handleSelect = useCallback((profile: Profile) => {
    if (!mentionQuery) return;

    // Get the username to insert (display name without spaces)
    const username = profile.display_name
      ? profile.display_name.replace(/\s+/g, "")
      : profile.email?.split("@")[0] || "user";

    // Build new text with mention inserted
    const before = value.substring(0, mentionQuery.start);
    const after = value.substring(cursorPosition);
    const newText = `${before}@${username} ${after}`;

    // Calculate new cursor position (after the mention + space)
    const newCursorPos = mentionQuery.start + username.length + 2; // +2 for @ and space

    onSelect(newText, newCursorPos);
  }, [mentionQuery, value, cursorPosition, onSelect]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredProfiles.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" && filteredProfiles[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredProfiles[selectedIndex]);
      } else if (e.key === "Escape") {
        // Let parent handle escape
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredProfiles, handleSelect]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute z-50 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className
      )}
      style={{
        bottom: "100%",
        left: 0,
        marginBottom: "0.5rem",
      }}
    >
      <ScrollArea className="max-h-[200px]">
        <div ref={listRef} className="space-y-0.5">
          {filteredProfiles.map((profile, index) => (
            <button
              key={profile.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSelect(profile)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col items-start overflow-hidden">
                <span className="font-medium truncate w-full">
                  {profile.display_name || "Unknown User"}
                </span>
                {profile.email && (
                  <span className="text-xs text-muted-foreground truncate w-full">
                    @{profile.email.split("@")[0]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-1 border-t pt-1 px-2 pb-1">
        <p className="text-xs text-muted-foreground">
          ↑↓ to navigate • Enter to select • Esc to close
        </p>
      </div>
    </div>
  );
}
