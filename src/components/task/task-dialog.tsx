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
  defaultAssigneeId?: string | null;
  defaultProjectId?: string | null;
  defaultSectionId?: string | null;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  loading?: boolean;
  /** Called after submit with selected entity IDs to link */
  onEntitiesSelected?: (entityIds: { id: string; type: string }[]) => void;
}

export function TaskDialog({
  open,
  onOpenChange,
  projects,
  profiles,
  task,
  defaultStatus = "todo",
  defaultAssigneeId,
  defaultProjectId,
  defaultSectionId,
  onSubmit,
  loading = false,
  onEntitiesSelected,
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
          defaultAssigneeId={defaultAssigneeId}
          defaultProjectId={defaultProjectId}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isEditing={isEditing}
          loading={loading}
          onEntitiesSelected={onEntitiesSelected}
        />
      </DialogContent>
    </Dialog>
  );
}
