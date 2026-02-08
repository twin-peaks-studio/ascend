"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
  const { user } = useAuth();

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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        className="min-h-[80px] resize-none"
        disabled={isSubmitting}
      />
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
