"use client";

/**
 * FollowupChat
 *
 * Tester-facing post-submission AI chat UI.
 * Mirrors ConversationalTaskModal's chat thread visually.
 * Auto-triggers the first AI evaluation on mount via useSubmissionFollowup.
 * On completion, shows the CompletionScreen.
 */

import { useState, useRef, useEffect } from "react";
import { useSubmissionFollowup } from "@/hooks/use-submission-followup";
import { CompletionScreen } from "./completion-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface FollowupChatProps {
  slug: string;
  submissionId: string;
  taskId: string;
}

export function FollowupChat({ slug, submissionId, taskId }: FollowupChatProps) {
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { status, messages, error, sendReply } = useSubmissionFollowup({
    slug,
    submissionId,
    taskId,
  });

  // Scroll to bottom on each new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!inputValue.trim() || status !== "asking") return;
    const text = inputValue;
    setInputValue("");
    await sendReply(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Done state → hand off to CompletionScreen ───────────────────────────

  if (status === "done") {
    return <CompletionScreen slug={slug} submissionId={submissionId} />;
  }

  // ─── Chat UI ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">A couple of quick follow-up questions</p>
        <p className="text-xs text-muted-foreground">
          Help us get the details right — this takes less than a minute.
        </p>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Loading / reviewing state */}
        {(status === "reviewing" || (status !== "asking" && messages.length === 0)) && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Reviewing your submission…</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {/* In-flight indicator */}
        {status === "waiting" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Thinking…</span>
          </div>
        )}

        {status === "complete" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Finalizing your report…</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer…"
          disabled={status !== "asking"}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!inputValue.trim() || status !== "asking"}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
