"use client";

/**
 * TaskExtractionDialog Component
 *
 * Main dialog for AI task extraction flow:
 * - Loading state while extracting
 * - Error state with retry option
 * - Review state with task list
 * - Success state with completion message
 */

import { Loader2, AlertCircle, Sparkles, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExtractedTaskList } from "./extracted-task-list";
import type { UseTaskExtractionReturn } from "@/lib/ai/types";

interface TaskExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: UseTaskExtractionReturn;
  onRetry: () => void;
}

export function TaskExtractionDialog({
  open,
  onOpenChange,
  extraction,
  onRetry,
}: TaskExtractionDialogProps) {
  const {
    status,
    extractedTasks,
    error,
    createdCount,
    updateTask,
    toggleSelection,
    selectAll,
    deselectAll,
    createSelectedTasks,
    reset,
  } = extraction;

  const selectedCount = extractedTasks.filter((t) => t.selected).length;

  const handleClose = () => {
    onOpenChange(false);
    // Reset after dialog closes to avoid flash of old content
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Extracting state */}
        {status === "extracting" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Analyzing Note
              </DialogTitle>
              <DialogDescription>
                AI is identifying actionable tasks from your note content...
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        )}

        {/* Error state */}
        {status === "error" && error && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Extraction Failed
              </DialogTitle>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertDescription>
                {error.message}
                {error.type === "rate_limit" && error.retryAfter && (
                  <> Please try again in {error.retryAfter} seconds.</>
                )}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={onRetry}>Try Again</Button>
            </DialogFooter>
          </>
        )}

        {/* Review state */}
        {status === "reviewing" && extractedTasks.length > 0 && (
          <div className="flex flex-col min-h-0 flex-1">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Found {extractedTasks.length} Potential Task
                {extractedTasks.length !== 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription>
                Review and edit the extracted tasks. Uncheck any you don&apos;t
                want to create.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden py-2">
              <ExtractedTaskList
                tasks={extractedTasks}
                onUpdateTask={updateTask}
                onToggleSelection={toggleSelection}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
              />
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={createSelectedTasks}
                disabled={selectedCount === 0}
              >
                Create {selectedCount} Task{selectedCount !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Creating state */}
        {status === "creating" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Creating Tasks
              </DialogTitle>
              <DialogDescription>
                Creating {selectedCount} task{selectedCount !== 1 ? "s" : ""}...
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {createdCount} of {selectedCount} created
              </span>
            </div>
          </>
        )}

        {/* Success state */}
        {status === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Tasks Created
              </DialogTitle>
              <DialogDescription>
                Successfully created {createdCount} task
                {createdCount !== 1 ? "s" : ""} from your note.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
