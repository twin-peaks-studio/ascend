"use client";

/**
 * FormBuilderModal
 *
 * Full-screen AI chat modal for creating feedback forms through natural language.
 * Mirrors ConversationalTaskModal in layout and UX.
 *
 * Flow:
 * 1. Developer describes the form they want
 * 2. AI asks clarifying questions or proposes fields immediately
 * 3. Field preview appears inline in the chat thread
 * 4. Developer clicks "Create Form" → enters title + password
 * 5. Form is created and the developer gets a shareable URL
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  ClipboardList,
  Loader2,
  Send,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FormFieldPreview } from "@/components/forms/form-field-preview";
import { useFormBuilder } from "@/hooks/use-form-builder";

// ─── Message Bubble ────────────────────────────────────────────────────────────

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
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
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
        <ClipboardList className="h-3.5 w-3.5 text-primary" />
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

// ─── Confirm Step (title + password) ──────────────────────────────────────────

interface ConfirmStepProps {
  projectId: string;
  projectTitle?: string | null;
  onBack: () => void;
  onCreated: (slug: string) => void;
  confirmCreate: (
    title: string,
    password: string,
    context: { projectId: string; projectTitle?: string | null }
  ) => Promise<boolean>;
  isCreating: boolean;
  error: string | null;
}

function ConfirmStep({
  projectId,
  projectTitle,
  onBack,
  onCreated,
  confirmCreate,
  isCreating,
  error,
}: ConfirmStepProps) {
  const [formTitle, setFormTitle] = useState(
    projectTitle ? `${projectTitle} Bug Report` : ""
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit =
    formTitle.trim().length >= 1 &&
    password.length >= 6 &&
    password === confirmPassword &&
    !isCreating;

  const handleSubmit = async () => {
    setLocalError(null);

    if (formTitle.trim().length < 1) {
      setLocalError("Form title is required");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    const success = await confirmCreate(formTitle, password, {
      projectId,
      projectTitle,
    });

    // If success, the parent hook transitions to "done" and onCreated is called
    // via the parent component watching status. If failure, error is set on hook.
    if (success) {
      // Parent watches status change to "done"
      onCreated(formTitle);
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      <div className="space-y-5 max-w-sm mx-auto">
        {/* Back button */}
        <button
          onClick={onBack}
          disabled={isCreating}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to preview
        </button>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Set form details</h3>
          <p className="text-xs text-muted-foreground">
            Give your form a name and set a password testers will use to access it.
          </p>
        </div>

        {/* Form title */}
        <div className="space-y-1.5">
          <Label htmlFor="form-title" className="text-xs">
            Form title
          </Label>
          <Input
            id="form-title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder={projectTitle ? `${projectTitle} Bug Report` : "Bug Report Form"}
            maxLength={100}
            disabled={isCreating}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="form-password" className="text-xs">
            Access password
          </Label>
          <div className="relative">
            <Input
              id="form-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              maxLength={128}
              disabled={isCreating}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="form-password-confirm" className="text-xs">
            Confirm password
          </Label>
          <Input
            id="form-password-confirm"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            maxLength={128}
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>

        {/* Error */}
        {displayError && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{displayError}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating form…
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Create Form
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Done Step ─────────────────────────────────────────────────────────────────

interface DoneStepProps {
  slug: string;
  onClose: () => void;
  onStartOver: () => void;
}

function DoneStep({ slug, onClose, onStartOver }: DoneStepProps) {
  const [copied, setCopied] = useState(false);
  const formUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/forms/${slug}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }, [formUrl]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-center py-8">
        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Form created!</h3>
          <p className="text-xs text-muted-foreground">
            Share this URL with your testers.
          </p>
        </div>

        {/* URL copy */}
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="flex-1 text-xs text-muted-foreground truncate font-mono">
              {formUrl}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface FormBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string | null;
  onFormCreated?: () => void;
}

export function FormBuilderModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onFormCreated,
}: FormBuilderModalProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    messages,
    proposedForm,
    turnLimitReached,
    error,
    createdFormSlug,
    sendMessage,
    proceedToConfirm,
    backToReviewing,
    confirmCreate,
    reset,
    startOver,
  } = useFormBuilder();

  const context = { projectId, projectTitle };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, proposedForm]);

  // Focus input when modal opens or returns to chatting
  useEffect(() => {
    if (
      open &&
      (status === "idle" || status === "chatting" || status === "reviewing")
    ) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, status]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(reset, 300);
    setInputValue("");
  }, [onOpenChange, reset]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || status === "waiting" || status === "creating") return;
    setInputValue("");
    await sendMessage(text, context);
  }, [inputValue, status, sendMessage, context]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFormCreated = useCallback(() => {
    onFormCreated?.();
  }, [onFormCreated]);

  const canSend =
    inputValue.trim().length > 0 &&
    status !== "waiting" &&
    status !== "creating" &&
    status !== "done" &&
    status !== "confirming";

  const showFieldPreview =
    proposedForm !== null &&
    (status === "reviewing" || status === "confirming" || status === "creating");

  const isConfirming = status === "confirming" || status === "creating";

  const inputPlaceholder =
    status === "error"
      ? "Try again…"
      : status === "reviewing"
      ? "Ask for changes, or click Create Form…"
      : messages.length === 0
      ? "Describe the form you want to create…"
      : "Reply…";

  // Watch for status → "done" to notify parent
  useEffect(() => {
    if (status === "done") {
      handleFormCreated();
    }
  }, [status, handleFormCreated]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="
          flex flex-col p-0 gap-0 overflow-hidden
          w-full h-dvh rounded-none
          sm:w-[95vw] sm:max-w-2xl sm:h-[85dvh] sm:rounded-lg
        "
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Create Feedback Form
            {projectTitle && (
              <span className="text-xs font-normal text-muted-foreground">
                · {projectTitle}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Confirm step — replaces chat */}
        {isConfirming ? (
          <ConfirmStep
            projectId={projectId}
            projectTitle={projectTitle}
            onBack={backToReviewing}
            onCreated={handleFormCreated}
            confirmCreate={confirmCreate}
            isCreating={status === "creating"}
            error={error}
          />
        ) : status === "done" && createdFormSlug ? (
          <DoneStep
            slug={createdFormSlug}
            onClose={handleClose}
            onStartOver={startOver}
          />
        ) : (
          <>
            {/* Scrollable chat thread */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              {/* Welcome message */}
              {messages.length === 0 && (
                <MessageBubble
                  role="assistant"
                  content={
                    projectTitle
                      ? `I'll help you create a feedback form for ${projectTitle}. What kind of form do you need? For example: "a bug report form" or "a feature request form with severity levels".`
                      : "I'll help you create a feedback form. What kind of form do you need? For example: \"a bug report form\" or \"a general feedback form\"."
                  }
                />
              )}

              {/* Conversation + inline field preview */}
              {messages.map((msg, index) => {
                const isLastMessage = index === messages.length - 1;
                const attachPreview =
                  msg.role === "assistant" &&
                  isLastMessage &&
                  showFieldPreview &&
                  proposedForm;

                return (
                  <div key={index} className="space-y-3">
                    <MessageBubble role={msg.role} content={msg.content} />

                    {attachPreview && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground px-1">
                          {proposedForm.fields.length} field
                          {proposedForm.fields.length !== 1 ? "s" : ""} proposed:
                        </p>
                        <FormFieldPreview fields={proposedForm.fields} />

                        {/* Approve row */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                          <p className="text-xs text-muted-foreground">
                            Looks good? Set a title and password to create the form.
                          </p>
                          <Button
                            onClick={proceedToConfirm}
                            className="gap-2 shrink-0"
                            size="sm"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Create Form
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {status === "waiting" && <TypingIndicator />}

              {/* Error */}
              {status === "error" && error && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Turn limit hint */}
              {turnLimitReached && (
                <p className="text-xs text-muted-foreground text-center italic">
                  Maximum turns reached — the AI will now propose a form based on
                  what it knows.
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {status !== "done" && (
              <div className="border-t px-4 py-3 flex gap-2 shrink-0">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={inputPlaceholder}
                  disabled={status === "waiting"}
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
          </>
        )}

        {/* Done footer */}
        {status === "done" && (
          <div className="border-t px-5 py-3 flex justify-end gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={startOver}>
              Create another form
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
