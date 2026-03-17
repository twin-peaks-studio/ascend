"use client";

/**
 * useSubmissionFollowup
 *
 * State machine hook for the post-submission AI follow-up chat.
 * Mirrors useConversationalTaskCreation in structure but with key differences:
 *   - First AI call fires automatically on mount (no user message needed)
 *   - Max 3 questions (not 5 turns)
 *   - Terminal state is "complete" — no user confirmation step
 *   - On complete: PATCHes submission + task with final content
 *
 * States:
 *   idle → reviewing (auto, on mount) → asking → waiting → asking (repeat ≤3) → complete → done
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { logger } from "@/lib/logger/logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FollowupStatus =
  | "idle"
  | "reviewing"   // first AI call in-flight (auto-triggered on mount)
  | "asking"      // AI has a question, waiting for tester response
  | "waiting"     // request in-flight after tester submits answer
  | "complete"    // AI is done, finalizing submission+task
  | "done"        // all done, show completion screen
  | "error";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface FollowupCompleteData {
  taskTitle: string;
  aiSummary: string;
  additionalContext: Record<string, string>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSubmissionFollowup({
  slug,
  submissionId,
  taskId,
}: {
  slug: string;
  submissionId: string;
  taskId: string;
}) {
  const [status, setStatus] = useState<FollowupStatus>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasFiredInitial = useRef(false);

  /**
   * PATCH the submission + task with final content, then transition to "done".
   */
  const finalizeSubmission = useCallback(
    async (transcript: ConversationMessage[], complete: FollowupCompleteData) => {
      setStatus("complete");

      try {
        await fetch(`/api/forms/${slug}/submissions/${submissionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: complete.taskTitle,
            aiSummary: complete.aiSummary,
            additionalContext: complete.additionalContext,
            followupTranscript: transcript,
          }),
        });
      } catch (err) {
        // Log but proceed — the submission is saved; only the task update failed
        logger.error("Failed to finalize submission", { error: err, submissionId });
      }

      setStatus("done");
    },
    [slug, submissionId]
  );

  /**
   * Call the AI API. Used both for the initial auto-trigger and for user replies.
   * @param updatedMessages - Full conversation history including the latest user message (if any).
   * @param currentQuestionCount - How many questions the AI has asked so far.
   */
  const callAI = useCallback(
    async (
      updatedMessages: ConversationMessage[],
      currentQuestionCount: number
    ) => {
      setError(null);

      try {
        const res = await fetch(`/api/forms/${slug}/followup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            messages: updatedMessages,
            questionCount: currentQuestionCount,
          }),
        });

        const data = await res.json();

        if (!data.success) {
          const retryAfter = data.error?.retryAfter;
          const msg = retryAfter
            ? `${data.error.message} Please try again in ${retryAfter} seconds.`
            : (data.error?.message ?? "Something went wrong. Please try again.");
          setError(msg);
          setStatus("error");
          return;
        }

        if (data.type === "question") {
          const assistantMsg: ConversationMessage = {
            role: "assistant",
            content: data.content,
          };
          setMessages([...updatedMessages, assistantMsg]);
          setQuestionCount((q) => q + 1);
          setStatus("asking");
        } else if (data.type === "complete") {
          // Persist to DB
          await finalizeSubmission(updatedMessages, data as FollowupCompleteData);
        }
      } catch (err) {
        logger.error("Submission followup network error", { error: err });
        setError("Network error. Please check your connection and try again.");
        setStatus("error");
      }
    },
    [slug, submissionId, finalizeSubmission]
  );

  /**
   * Tester sends a reply to an AI question.
   */
  const sendReply = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== "asking") return;

      const userMsg: ConversationMessage = { role: "user", content: trimmed };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setStatus("waiting");

      await callAI(updatedMessages, questionCount);
    },
    [status, messages, questionCount, callAI]
  );

  /**
   * Auto-fire the initial AI evaluation on mount.
   */
  useEffect(() => {
    if (hasFiredInitial.current) return;
    hasFiredInitial.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("reviewing");
    callAI([], 0);
  }, [callAI]);

  return {
    status,
    messages,
    error,
    taskId,
    sendReply,
  };
}
