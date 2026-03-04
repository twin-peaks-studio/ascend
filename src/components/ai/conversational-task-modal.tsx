"use client";

/**
 * ConversationalTaskModal
 *
 * Full-screen AI chat modal for creating tasks through natural language.
 * The modal detects the current project context from the URL (usePathname)
 * so it can be rendered from the sidebar without needing route params.
 *
 * Flow:
 * 1. User opens modal and types a task description
 * 2. AI either proposes tasks immediately (simple) or asks a clarifying question
 * 3. Task cards appear inline in the chat thread for editing / approval
 * 4. User can edit cards, type follow-ups, or click "Create tasks" to confirm
 * 5. After creation, a success bubble appears and the footer swaps to Close/New chat
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Send,
  CheckCircle,
  Circle,
  AlertCircle,
  UserCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import {
  useConversationalTaskCreation,
  type ProposedTask,
  type PageContext,
} from "@/hooks/use-conversational-task-creation";
import { PRIORITY_DISPLAY_SHORT } from "@/types";

// ─── Priority helpers ──────────────────────────────────────────────────────────

// Use app-standard P1/P2/P3/P4 labels (matches the rest of the app)
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500 bg-red-500/10",
  high: "text-orange-500 bg-orange-500/10",
  medium: "text-blue-500 bg-blue-500/10",
  low: "text-muted-foreground bg-muted",
};

// ─── Due date display helper ───────────────────────────────────────────────────

/**
 * Returns a human-readable label for a yyyy-MM-dd date string.
 * "Today", "Tomorrow", "Mar 5", or "Mar 5, 2027" for other years.
 */
function formatDueDateLabel(dueDate: string, clientDate: string): string {
  const tomorrow = (() => {
    const d = new Date(`${clientDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  if (dueDate === clientDate) return "Today";
  if (dueDate === tomorrow) return "Tomorrow";

  const date = new Date(`${dueDate}T00:00:00`);
  const currentYear = new Date(`${clientDate}T00:00:00`).getFullYear();
  if (date.getFullYear() === currentYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Task Proposal Card ────────────────────────────────────────────────────────

interface TaskProposalCardProps {
  task: ProposedTask;
  onUpdate: (id: string, updates: Partial<ProposedTask>) => void;
  onToggle: (id: string) => void;
  currentUser: { id: string; email?: string | null } | null;
  clientDate: string;
}

function TaskProposalCard({ task, onUpdate, onToggle, currentUser, clientDate }: TaskProposalCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const [descriptionValue, setDescriptionValue] = useState(task.description ?? "");

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const handleTitleCommit = useCallback(() => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed });
    } else {
      setTitleValue(task.title);
    }
    setEditingTitle(false);
  }, [titleValue, task.id, task.title, onUpdate]);

  const handleTitleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleTitleCommit();
      if (e.key === "Escape") {
        setTitleValue(task.title);
        setEditingTitle(false);
      }
    },
    [handleTitleCommit, task.title]
  );

  const handleDescriptionBlur = useCallback(() => {
    const trimmed = descriptionValue.trim();
    onUpdate(task.id, { description: trimmed || null });
  }, [descriptionValue, task.id, onUpdate]);

  const userInitial = currentUser?.email?.[0]?.toUpperCase() ?? "?";
  const isAssignedToMe = !!task.assigneeId;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background transition-opacity",
        !task.selected && "opacity-50"
      )}
    >
      {/* Top row: checkbox + title. Add pb-3 when collapsed (meta/desc hidden). */}
      <div className={cn("flex items-start gap-3 px-3 pt-3", !task.selected && "pb-3")}>
        <button
          onClick={() => onToggle(task.id)}
          className="mt-0.5 shrink-0 text-primary"
          aria-label={task.selected ? "Deselect task" : "Select task"}
        >
          {task.selected ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleCommit}
              onKeyDown={handleTitleKeyDown}
              className="h-7 text-sm font-medium py-0"
              maxLength={200}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="block w-full text-left text-sm font-medium hover:text-primary transition-colors"
            >
              {task.title}
            </button>
          )}
        </div>
      </div>

      {/* Meta row + description — hidden when task is deselected */}
      {/* Meta row: 3 columns — Priority | Due date | Assignee */}
      <div className={cn("grid grid-cols-3 gap-2 px-3 py-3 pl-11", !task.selected && "hidden")}>
        {/* Priority */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Priority
          </span>
          <select
            value={task.priority}
            onChange={(e) =>
              onUpdate(task.id, { priority: e.target.value as ProposedTask["priority"] })
            }
            className={cn(
              "text-sm font-medium px-2 py-1.5 rounded-md border border-border cursor-pointer w-full min-w-0",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              PRIORITY_COLORS[task.priority]
            )}
          >
            {(["urgent", "high", "medium", "low"] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_DISPLAY_SHORT[p].label}
              </option>
            ))}
          </select>
        </div>

        {/* Due date */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Due date
          </span>
          <div className="relative min-w-0">
            {/* Styled button shows human-readable label */}
            <button
              type="button"
              onClick={() => {
                const input = dueDateInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === "function") {
                  input.showPicker();
                } else {
                  input.click();
                }
              }}
              className={cn(
                "text-sm border border-border rounded-md px-2 py-1.5 cursor-pointer w-full text-left truncate",
                "focus:outline-none focus:ring-1 focus:ring-ring hover:border-ring transition-colors",
                task.dueDate ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {task.dueDate ? formatDueDateLabel(task.dueDate, clientDate) : "No date"}
            </button>
            {/* Hidden native date input — opened programmatically via showPicker() */}
            <input
              ref={dueDateInputRef}
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
              className="absolute opacity-0 pointer-events-none w-px h-px"
              tabIndex={-1}
              aria-hidden
            />
          </div>
        </div>

        {/* Assignee */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Assignee
          </span>
          <button
            onClick={() =>
              onUpdate(task.id, {
                assigneeId: isAssignedToMe ? null : (currentUser?.id ?? null),
              })
            }
            title={isAssignedToMe ? "Click to unassign" : "Click to assign to me"}
            className={cn(
              "flex items-center gap-1.5 text-sm rounded-md border px-2 py-1.5 w-full transition-colors truncate",
              isAssignedToMe
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {isAssignedToMe ? (
              <>
                <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {userInitial}
                </span>
                <span className="truncate">Me</span>
              </>
            ) : (
              <>
                <UserCircle className="h-5 w-5 shrink-0" />
                <span className="truncate">Unassigned</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description — always-visible, same visual weight as other fields */}
      <div className={cn("px-3 pb-3 pl-11", !task.selected && "hidden")}>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">
          Description
        </span>
        <textarea
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          onBlur={handleDescriptionBlur}
          className={cn(
            "w-full text-sm text-foreground bg-transparent border border-border rounded-md",
            "px-2 py-1.5 resize-none",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "placeholder:text-muted-foreground"
          )}
          rows={2}
          maxLength={2000}
          placeholder="Add a description…"
        />
      </div>
    </div>
  );
}

// ─── Chat Message Bubble ───────────────────────────────────────────────────────

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            // Distinct indigo/violet for user messages — visually different from
            // the primary teal accent used for buttons, badges, and AI avatar
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {content}
      </div>
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface ConversationalTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationalTaskModal({
  open,
  onOpenChange,
}: ConversationalTaskModalProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect project context from URL — works anywhere in the component tree
  // because usePathname() doesn't require being inside the page route segment
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;

  const { project } = useProject(projectId);

  const {
    status,
    messages,
    proposedTasks,
    turnCount,
    error,
    createdCount,
    selectedCount,
    sendMessage,
    updateTask,
    toggleSelection,
    confirmCreate,
    reset,
    startOver,
  } = useConversationalTaskCreation();

  // Compute the client's local date (YYYY-MM-DD) to send to the API.
  // Using the client clock avoids UTC timezone skew on the server — e.g. if
  // the server is ahead of the user's local time by a day.
  const clientDate = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const pageContext: PageContext = {
    projectId,
    projectTitle: project?.title ?? null,
    currentPath: pathname,
    clientDate,
    currentUserId: user?.id ?? null,
  };

  // Auto-scroll to bottom when new messages or status changes arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, proposedTasks]);

  // Focus input when modal opens or returns to chatting
  useEffect(() => {
    if (open && status !== "done" && status !== "creating") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, status]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Delay reset so close animation plays before clearing state
    setTimeout(reset, 300);
    setInputValue("");
  }, [onOpenChange, reset]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || status === "waiting" || status === "creating" || status === "done") return;
    setInputValue("");
    await sendMessage(text, pageContext);
  }, [inputValue, status, sendMessage, pageContext]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleConfirmCreate = useCallback(async () => {
    await confirmCreate();
  }, [confirmCreate]);

  // Input is active whenever the user can meaningfully type — including
  // during "reviewing" so they can ask for changes without approving.
  const canSend =
    inputValue.trim().length > 0 &&
    status !== "waiting" &&
    status !== "creating" &&
    status !== "done";

  const showTaskCards =
    proposedTasks.length > 0 &&
    (status === "reviewing" || status === "creating");

  const turnLimitReached = turnCount >= 5 && status === "chatting";

  // Input placeholder adapts to current status
  const inputPlaceholder =
    status === "error"
      ? "Try again…"
      : status === "reviewing"
      ? "Ask for changes, or approve the tasks above…"
      : messages.length === 0
      ? "Describe what you'd like to work on…"
      : "Reply…";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="
          flex flex-col p-0 gap-0 overflow-hidden
          w-full h-dvh rounded-none
          sm:w-[95vw] sm:max-w-2xl sm:h-[85dvh] sm:rounded-lg
        ">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Create with AI
            {project && (
              <span className="text-xs font-normal text-muted-foreground">
                · {project.title}
              </span>
            )}
            <span className="ml-1 text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              beta
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Unified scrollable chat thread */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {/* Welcome message (shown before first user message) */}
          {messages.length === 0 && (
            <MessageBubble
              role="assistant"
              content={
                project
                  ? `I'll help you create tasks for ${project.title}. What would you like to work on?`
                  : "I'll help you create a task. What would you like to work on?"
              }
            />
          )}

          {/* Conversation messages + inline task cards */}
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            // Attach task cards below the last assistant message that triggered them
            const attachTaskCards =
              msg.role === "assistant" && isLastMessage && showTaskCards;

            return (
              <div key={index} className="space-y-3">
                <MessageBubble role={msg.role} content={msg.content} />

                {attachTaskCards && (
                  <div className="space-y-2">
                    {/* Static project context note — no per-task project picker */}
                    {project && (
                      <p className="text-xs text-muted-foreground px-1">
                        Tasks will be added to{" "}
                        <span className="font-medium text-foreground">
                          {project.title}
                        </span>
                      </p>
                    )}

                    {/* Editable task cards — full width */}
                    {proposedTasks.map((task) => (
                      <TaskProposalCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                        onToggle={toggleSelection}
                        currentUser={user ? { id: user.id, email: user.email } : null}
                        clientDate={clientDate}
                      />
                    ))}

                    {/* Approve / creating row — clearly separated from cards */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        {selectedCount === 0
                          ? "Select at least one task to create"
                          : `${selectedCount} of ${proposedTasks.length} task${proposedTasks.length !== 1 ? "s" : ""} selected`}
                      </p>
                      {status === "creating" ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Creating tasks…</span>
                        </div>
                      ) : (
                        <Button
                          onClick={handleConfirmCreate}
                          disabled={selectedCount === 0}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Create {selectedCount > 0 ? selectedCount : ""} task
                          {selectedCount !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {status === "waiting" && <TypingIndicator />}

          {/* Error message */}
          {status === "error" && error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Success bubble — appears inline in the chat */}
          {status === "done" && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-foreground">
                {createdCount} task{createdCount !== 1 ? "s" : ""} created successfully!
              </div>
            </div>
          )}

          {/* Turn limit hint */}
          {turnLimitReached && (
            <p className="text-xs text-muted-foreground text-center italic">
              Maximum turns reached — the AI will now propose tasks based on what it knows.
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area — visible whenever the user can still type */}
        {status !== "done" && (
          <div className="border-t px-4 py-3 flex gap-2 shrink-0">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={inputPlaceholder}
              disabled={status === "waiting" || status === "creating"}
              className="flex-1"
              maxLength={2000}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send"
            >
              {status === "waiting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* Done footer — replaces input after tasks are created */}
        {status === "done" && (
          <div className="border-t px-5 py-3 flex justify-end gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={startOver}>
              Start new chat
            </Button>
            <Button size="sm" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
