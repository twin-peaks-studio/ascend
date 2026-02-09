"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProjectMembers } from "@/hooks/use-project-members";
import { getInitials } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import type { CommentInsert, Profile } from "@/types";

export interface MentionedUser {
  userId: string;
  displayName: string;
}

interface CommentFormProps {
  taskId?: string | null;
  projectId?: string | null;
  /** Project ID used to look up members for @mentions. Separate from projectId (which is the comment's parent). */
  mentionProjectId?: string | null;
  onSubmit: (input: CommentInsert, mentions: MentionedUser[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function CommentForm({
  taskId,
  projectId,
  mentionProjectId,
  onSubmit,
  isSubmitting = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<MentionedUser[]>([]);
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention dropdown state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch project members for mentions
  const { members } = useProjectMembers(mentionProjectId ?? null);

  // Filter members based on mention query (exclude self)
  const filteredMembers = members.filter((member) => {
    if (member.user_id === user?.id) return false;
    if (!mentionQuery) return true;
    const name = member.profile?.display_name?.toLowerCase() ?? "";
    const email = member.profile?.email?.toLowerCase() ?? "";
    const query = mentionQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const insertMention = useCallback(
    (profile: Profile) => {
      const textarea = textareaRef.current;
      if (!textarea || mentionStartIndex === -1) return;

      const displayName = profile.display_name || profile.email || "User";
      const before = content.slice(0, mentionStartIndex);
      const after = content.slice(textarea.selectionStart);
      const mentionText = `@${displayName} `;
      const newContent = before + mentionText + after;

      setContent(newContent);
      setMentions((prev) => {
        if (prev.some((m) => m.userId === profile.id)) return prev;
        return [...prev, { userId: profile.id, displayName }];
      });
      setShowMentionDropdown(false);
      setMentionQuery("");
      setMentionStartIndex(-1);

      // Restore focus and cursor position
      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = before.length + mentionText.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content, mentionStartIndex]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown || filteredMembers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionIndex((prev) =>
        prev < filteredMembers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionIndex((prev) =>
        prev > 0 ? prev - 1 : filteredMembers.length - 1
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const selected = filteredMembers[selectedMentionIndex];
      if (selected?.profile) {
        insertMention(selected.profile);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(value);

    // Only enable mentions if we have a project context with members
    if (!mentionProjectId || members.length === 0) return;

    // Look backwards from cursor for an @ that starts a mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (query.length <= 30 && !query.includes("\n")) {
          setMentionStartIndex(lastAtIndex);
          setMentionQuery(query);
          setSelectedMentionIndex(0);
          setShowMentionDropdown(true);
          return;
        }
      }
    }

    setShowMentionDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !user) return;

    const input: CommentInsert = {
      content: content.trim(),
      author_id: user.id,
      task_id: taskId || null,
      project_id: projectId || null,
    };

    await onSubmit(input, mentions);
    setContent("");
    setMentions([]);
  };

  const hasMentionSupport = !!mentionProjectId && members.length > 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            hasMentionSupport
              ? "Write a comment... (type @ to mention)"
              : "Write a comment..."
          }
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
        />

        {/* Mention dropdown */}
        {showMentionDropdown && filteredMembers.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md border bg-popover shadow-md"
          >
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredMembers.map((member, index) => {
                const profile = member.profile;
                if (!profile) return null;
                const name =
                  profile.display_name || profile.email || "Unknown";
                return (
                  <button
                    key={member.user_id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                      index === selectedMentionIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(profile);
                    }}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(profile.display_name, profile.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium">{name}</p>
                      {profile.display_name && profile.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {profile.email}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Post Comment
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
