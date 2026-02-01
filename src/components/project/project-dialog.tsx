"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectForm } from "./project-form";
import type { Project } from "@/types";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validation";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSubmit: (data: CreateProjectInput | UpdateProjectInput) => Promise<void>;
  loading?: boolean;
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSubmit,
  loading = false,
}: ProjectDialogProps) {
  const isEditing = !!project;

  const handleSubmit = async (data: CreateProjectInput | UpdateProjectInput) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Project" : "Create Project"}
          </DialogTitle>
        </DialogHeader>
        <ProjectForm
          initialData={project || undefined}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isEditing={isEditing}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  );
}
