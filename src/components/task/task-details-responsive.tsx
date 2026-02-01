"use client";

import { useIsMobile } from "@/hooks/use-media-query";
import { TaskDetailsDialog } from "./task-details-dialog";
import { TaskEditMobile } from "./task-edit-mobile";
import type { TaskWithProject, Profile, Project } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";

interface TaskDetailsResponsiveProps {
  task: TaskWithProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: UpdateTaskInput) => Promise<void>;
  onDelete?: (taskId: string) => void;
  profiles: Profile[];
  projects: Project[];
  loading?: boolean;
}

/**
 * Responsive task details component that shows a drawer on mobile
 * and a dialog on desktop
 */
export function TaskDetailsResponsive({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  profiles,
  projects,
  loading = false,
}: TaskDetailsResponsiveProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <TaskEditMobile
        task={task}
        open={open}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
        onDelete={onDelete}
        profiles={profiles}
        loading={loading}
      />
    );
  }

  return (
    <TaskDetailsDialog
      task={task}
      open={open}
      onOpenChange={onOpenChange}
      onUpdate={onUpdate}
      onDelete={onDelete}
      profiles={profiles}
      projects={projects}
      loading={loading}
    />
  );
}
