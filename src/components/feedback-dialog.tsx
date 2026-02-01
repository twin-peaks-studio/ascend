"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Hardcoded values for the feedback system
const ASCEND_PROJECT_NAME = "Ascend";
const FEEDBACK_ASSIGNEE_EMAIL = "luisdavila612@gmail.com";

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user } = useAuth();

  const supabase = createClient();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIsSubmitted(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to submit feedback");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title for your feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Find the Ascend project by name
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .ilike("title", ASCEND_PROJECT_NAME)
        .limit(1)
        .single();

      if (projectError || !projectData) {
        console.error("Error finding Ascend project:", projectError);
        toast.error("Unable to submit feedback. Please try again later.");
        return;
      }

      // 2. Find the assignee by email
      const { data: assigneeData, error: assigneeError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", FEEDBACK_ASSIGNEE_EMAIL)
        .limit(1)
        .single();

      if (assigneeError || !assigneeData) {
        console.error("Error finding assignee:", assigneeError);
        toast.error("Unable to submit feedback. Please try again later.");
        return;
      }

      // 3. Get the highest position for the 'todo' status
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("position")
        .eq("status", "todo")
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existingTasks?.[0]?.position ?? -1;

      // 4. Create the feedback task
      const { error: insertError } = await supabase.from("tasks").insert({
        project_id: projectData.id,
        title: `[Feedback] ${title.trim()}`,
        description: description.trim() || null,
        status: "todo",
        priority: "medium",
        position: maxPosition + 1,
        assignee_id: assigneeData.id,
        created_by: user.id,
      });

      if (insertError) {
        console.error("Error creating feedback task:", insertError);
        toast.error("Failed to submit feedback. Please try again.");
        return;
      }

      // Show success state
      setIsSubmitted(true);
    } catch (error) {
      console.error("Unexpected error submitting feedback:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isSubmitted ? (
          // Thank you message
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl">Thank you!</DialogTitle>
              <DialogDescription className="text-base">
                Your feedback has been submitted successfully. We appreciate you
                taking the time to help us improve Ascend.
              </DialogDescription>
            </DialogHeader>
            <Button
              className="mt-6"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          // Feedback form
          <>
            <DialogHeader>
              <DialogTitle>Send Feedback</DialogTitle>
              <DialogDescription>
                Have a suggestion or found an issue? Let us know and we&apos;ll
                look into it.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-title">Title</Label>
                <Input
                  id="feedback-title"
                  placeholder="Brief summary of your feedback"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-description">Description</Label>
                <Textarea
                  id="feedback-description"
                  placeholder="Provide more details about your feedback (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !title.trim()}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
