"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "./task-form";
import type { Task, TaskStatus, Project, Profile } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  profiles: Profile[];
  task?: Task | null;
  defaultStatus?: TaskStatus;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  loading?: boolean;
}

export function TaskDialog({
  open,
  onOpenChange,
  projects,
  profiles,
  task,
  defaultStatus = "todo",
  onSubmit,
  loading = false,
}: TaskDialogProps) {
  const isEditing = !!task;

  const handleSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <TaskForm
          projects={projects}
          profiles={profiles}
          initialData={task || undefined}
          defaultStatus={defaultStatus}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isEditing={isEditing}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  );
}
