"use client";

/**
 * Conversational Task Creation Hook
 *
 * State machine for the AI-assisted, multi-turn task creation flow.
 * The AI either proposes tasks immediately (simple input) or asks clarifying
 * questions (complex input, max 5 turns) before surfacing editable task cards
 * for user approval. Tasks are created only after explicit user confirmation.
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskMutations } from "@/hooks/use-tasks";
import { projectKeys } from "@/hooks/use-projects";
import { logger } from "@/lib/logger/logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConversationStatus =
  | "idle"
  | "chatting"   // waiting for user input
  | "waiting"    // request in-flight
  | "reviewing"  // AI proposed tasks, user can edit
  | "creating"   // creating tasks in DB
  | "done"       // all done
  | "error";     // API or network error

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedTask {
  /** Client-side key — not sent to DB */
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  /** yyyy-MM-dd — converted to ISO datetime at creation time */
  dueDate: string | null;
  /** Project to assign this task to (per-task, overrides page context) */
  projectId: string | null;
  /** Assignee user ID — null means "assign to me" (current user) */
  assigneeId: string | null;
  selected: boolean;
}

export interface PageContext {
  projectId?: string | null;
  projectTitle?: string | null;
  currentPath: string;
  /** Client-side local date in YYYY-MM-DD format — avoids UTC timezone skew */
  clientDate?: string;
  /** Current user's ID — used to pre-assign proposed tasks to the creator */
  currentUserId?: string | null;
}

interface AIQuestionResponse {
  success: true;
  type: "question";
  content: string;
}

interface AITasksResponse {
  success: true;
  type: "tasks";
  message: string;
  tasks: Array<{
    title: string;
    description: string | null;
    priority: "low" | "medium" | "high" | "urgent";
    dueDate: string | null;
  }>;
}

interface AIErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    retryAfter?: number;
  };
}

type AIResponse = AIQuestionResponse | AITasksResponse | AIErrorResponse;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useConversationalTaskCreation() {
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const { createTask } = useTaskMutations();
  const queryClient = useQueryClient();

  /**
   * Send a user message and get the AI's response.
   * Transitions: chatting → waiting → chatting (question) | reviewing (tasks) | error
   */
  const sendMessage = useCallback(
    async (text: string, context: PageContext) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;

      const userMessage: ConversationMessage = { role: "user", content: trimmedText };
      const updatedMessages = [...messages, userMessage];
      const newTurnCount = turnCount + 1;

      setMessages(updatedMessages);
      setTurnCount(newTurnCount);
      setStatus("waiting");
      setError(null);
      // Clear any previously proposed task cards so stale cards don't linger
      // while waiting for the AI's next response
      setProposedTasks([]);

      try {
        const response = await fetch("/api/ai/chat-task-creation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            context: {
              projectId: context.projectId ?? undefined,
              projectTitle: context.projectTitle ?? undefined,
              currentPath: context.currentPath,
              clientDate: context.clientDate,
              // currentUserId is client-side only, not sent to AI API
            },
            turnCount: newTurnCount,
          }),
        });

        const data: AIResponse = await response.json();

        if (!data.success) {
          const errData = data as AIErrorResponse;
          const retryAfter = errData.error?.retryAfter;
          const message = retryAfter
            ? `${errData.error.message} Please try again in ${retryAfter} seconds.`
            : (errData.error?.message || "Something went wrong. Please try again.");
          setError(message);
          setStatus("error");
          return;
        }

        const successData = data as AIQuestionResponse | AITasksResponse;

        if (successData.type === "question") {
          const assistantMessage: ConversationMessage = {
            role: "assistant",
            content: successData.content,
          };
          setMessages([...updatedMessages, assistantMessage]);
          setStatus("chatting");
        } else if (successData.type === "tasks") {
          const assistantMessage: ConversationMessage = {
            role: "assistant",
            content: successData.message,
          };
          setMessages([...updatedMessages, assistantMessage]);

          const proposed: ProposedTask[] = successData.tasks.map((t, i) => ({
            id: `proposed-${Date.now()}-${i}`,
            title: t.title,
            description: t.description,
            priority: t.priority,
            dueDate: t.dueDate,
            // Inherit project context from the page URL; user can override per-task
            projectId: context.projectId ?? null,
            // Pre-assign to the current user; user can toggle to null (unassigned)
            assigneeId: context.currentUserId ?? null,
            selected: true,
          }));

          setProposedTasks(proposed);
          setConfirmationMessage(successData.message);
          setStatus("reviewing");
        }
      } catch (err) {
        logger.error("Conversational task creation network error", { error: err });
        setError("Network error. Please check your connection and try again.");
        setStatus("error");
      }
    },
    [messages, turnCount]
  );

  /**
   * Update a proposed task's fields before confirmation.
   */
  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<ProposedTask, "id">>) => {
      setProposedTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  /**
   * Toggle the selected state of a proposed task.
   */
  const toggleSelection = useCallback((id: string) => {
    setProposedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  }, []);

  /**
   * Create all selected proposed tasks in the database.
   * Transitions: reviewing → creating → done
   * Each task uses its own per-task projectId/assigneeId.
   * Invalidates all affected project caches so pages update immediately.
   */
  const confirmCreate = useCallback(
    async () => {
      const selectedTasks = proposedTasks.filter((t) => t.selected);
      if (selectedTasks.length === 0) return;

      setStatus("creating");
      setCreatedCount(0);

      let created = 0;
      const affectedProjectIds = new Set<string>();

      for (const task of selectedTasks) {
        // Convert yyyy-MM-dd → full ISO datetime expected by createTaskSchema
        const dueDate = task.dueDate ? `${task.dueDate}T00:00:00.000Z` : undefined;

        const result = await createTask({
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          status: "todo",
          position: 0,
          due_date: dueDate,
          project_id: task.projectId ?? null,
          assignee_id: task.assigneeId ?? null,
        });

        if (result) {
          created++;
          setCreatedCount(created);
          if (task.projectId) affectedProjectIds.add(task.projectId);
        }
      }

      // Invalidate each affected project's detail cache so project pages
      // show new tasks immediately without a full refresh.
      for (const pid of affectedProjectIds) {
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(pid) });
      }

      setStatus("done");
    },
    [proposedTasks, createTask, queryClient]
  );

  /**
   * Reset all state back to idle (called when modal closes).
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setMessages([]);
    setProposedTasks([]);
    setTurnCount(0);
    setError(null);
    setCreatedCount(0);
    setConfirmationMessage("");
  }, []);

  /**
   * Start a new conversation in the same modal session (after tasks are created).
   * Clears messages and proposals but keeps the modal open.
   */
  const startOver = useCallback(() => {
    setStatus("chatting");
    setMessages([]);
    setProposedTasks([]);
    setTurnCount(0);
    setError(null);
    setCreatedCount(0);
    setConfirmationMessage("");
  }, []);

  const selectedCount = proposedTasks.filter((t) => t.selected).length;

  return {
    status,
    messages,
    proposedTasks,
    turnCount,
    error,
    createdCount,
    selectedCount,
    confirmationMessage,
    sendMessage,
    updateTask,
    toggleSelection,
    confirmCreate,
    reset,
    startOver,
  };
}
