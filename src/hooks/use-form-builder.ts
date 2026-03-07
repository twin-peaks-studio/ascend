"use client";

/**
 * Form Builder Hook
 *
 * State machine for the AI-assisted, multi-turn feedback form creation flow.
 * The AI either proposes a form immediately (clear input) or asks clarifying
 * questions (max 5 turns) before surfacing the proposed field structure
 * for developer review. The form is created only after explicit confirmation
 * (including title + password entry).
 *
 * Mirrors useConversationalTaskCreation but for form creation.
 */

import { useState, useCallback } from "react";
import type { FormField } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FormBuilderStatus =
  | "idle"
  | "chatting"   // waiting for user input
  | "waiting"    // request in-flight
  | "reviewing"  // AI proposed fields, developer can review
  | "confirming" // developer entering title + password before creation
  | "creating"   // creating form in DB
  | "done"       // form created successfully
  | "error";

export interface FormBuilderMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedForm {
  message: string;
  fields: FormField[];
}

export interface FormBuilderContext {
  projectId: string;
  projectTitle?: string | null;
}

interface AIQuestionResponse {
  success: true;
  type: "question";
  content: string;
}

interface AIFormResponse {
  success: true;
  type: "form";
  message: string;
  fields: FormField[];
}

interface AIErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    retryAfter?: number;
  };
}

type AIResponse = AIQuestionResponse | AIFormResponse | AIErrorResponse;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useFormBuilder() {
  const [status, setStatus] = useState<FormBuilderStatus>("idle");
  const [messages, setMessages] = useState<FormBuilderMessage[]>([]);
  const [proposedForm, setProposedForm] = useState<ProposedForm | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createdFormSlug, setCreatedFormSlug] = useState<string | null>(null);

  /**
   * Send a user message and get the AI's response.
   * Transitions: chatting → waiting → chatting (question) | reviewing (form) | error
   */
  const sendMessage = useCallback(
    async (text: string, context: FormBuilderContext) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;

      const userMessage: FormBuilderMessage = { role: "user", content: trimmedText };
      const updatedMessages = [...messages, userMessage];
      const newTurnCount = turnCount + 1;

      setMessages(updatedMessages);
      setTurnCount(newTurnCount);
      setStatus("waiting");
      setError(null);
      setProposedForm(null);

      try {
        const response = await fetch("/api/ai/form-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            context: {
              projectId: context.projectId,
              projectTitle: context.projectTitle ?? undefined,
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

        const successData = data as AIQuestionResponse | AIFormResponse;

        if (successData.type === "question") {
          const assistantMessage: FormBuilderMessage = {
            role: "assistant",
            content: successData.content,
          };
          setMessages([...updatedMessages, assistantMessage]);
          setStatus("chatting");
        } else if (successData.type === "form") {
          const assistantMessage: FormBuilderMessage = {
            role: "assistant",
            content: successData.message,
          };
          setMessages([...updatedMessages, assistantMessage]);
          setProposedForm({ message: successData.message, fields: successData.fields });
          setStatus("reviewing");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
        setStatus("error");
      }
    },
    [messages, turnCount]
  );

  /**
   * Developer clicks "Create Form" after reviewing the proposed fields.
   * Transitions to confirming state (title + password entry step).
   */
  const proceedToConfirm = useCallback(() => {
    if (status !== "reviewing") return;
    setStatus("confirming");
  }, [status]);

  /**
   * Go back from confirming to reviewing.
   */
  const backToReviewing = useCallback(() => {
    if (status !== "confirming") return;
    setStatus("reviewing");
  }, [status]);

  /**
   * Create the form in the database with the given title and password.
   * Transitions: confirming → creating → done
   */
  const confirmCreate = useCallback(
    async (
      title: string,
      password: string,
      context: FormBuilderContext
    ): Promise<boolean> => {
      if (!proposedForm) return false;

      setStatus("creating");
      setError(null);

      try {
        const response = await fetch(`/api/projects/${context.projectId}/forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            password,
            fields: proposedForm.fields,
            aiBuilderHistory: messages,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error?.message ?? "Failed to create form");
          setStatus("confirming");
          return false;
        }

        setCreatedFormSlug(data.form.slug);
        setStatus("done");
        return true;
      } catch {
        setError("Network error. Please check your connection and try again.");
        setStatus("confirming");
        return false;
      }
    },
    [proposedForm, messages]
  );

  /**
   * Reset all state back to idle (called when modal closes).
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setMessages([]);
    setProposedForm(null);
    setTurnCount(0);
    setError(null);
    setCreatedFormSlug(null);
  }, []);

  /**
   * Start a new conversation in the same modal session.
   */
  const startOver = useCallback(() => {
    setStatus("chatting");
    setMessages([]);
    setProposedForm(null);
    setTurnCount(0);
    setError(null);
    setCreatedFormSlug(null);
  }, []);

  const turnLimitReached = turnCount >= 5 && status === "chatting";

  return {
    status,
    messages,
    proposedForm,
    turnCount,
    turnLimitReached,
    error,
    createdFormSlug,
    sendMessage,
    proceedToConfirm,
    backToReviewing,
    confirmCreate,
    reset,
    startOver,
  };
}
