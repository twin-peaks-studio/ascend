"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { MentionAutocomplete } from "./mention-autocomplete";
import type { CommentInsert } from "@/types";

interface CommentFormProps {
  taskId?: string | null;
  projectId?: string | null;
  onSubmit: (input: CommentInsert) => Promise<void>;
  isSubmitting?: boolean;
}

export function CommentForm({
  taskId,
  projectId,
  onSubmit,
  isSubmitting = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { profiles } = useProfiles();

  // Track cursor position for mention autocomplete
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Update cursor position on arrow keys, etc.
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      setCursorPosition(textareaRef.current?.selectionStart ?? 0);
    }
  };

  // Handle mention selection from autocomplete
  const handleMentionSelect = (newText: string, newCursorPos: number) => {
    setContent(newText);

    // Set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    }, 0);
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

    await onSubmit(input);
    setContent(""); // Clear form after successful submission
    setCursorPosition(0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onClick={handleTextareaClick}
          onKeyUp={handleTextareaKeyUp}
          placeholder="Write a comment... (Use @ to mention someone)"
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
        />

        {/* Mention autocomplete dropdown */}
        <MentionAutocomplete
          value={content}
          profiles={profiles}
          onSelect={handleMentionSelect}
          cursorPosition={cursorPosition}
        />
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
