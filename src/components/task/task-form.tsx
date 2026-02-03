"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { AssigneeSelector } from "@/components/task/assignee-selector";
import { useProjectAssignees } from "@/hooks/use-project-assignees";
import type { Task, TaskStatus, TaskPriority, Project, Profile } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";

const NO_PROJECT_VALUE = "__none__";

interface TaskFormProps {
  projects: Project[];
  profiles: Profile[];
  initialData?: Partial<Task>;
  defaultStatus?: TaskStatus;
  defaultAssigneeId?: string | null;
  defaultProjectId?: string | null;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  loading?: boolean;
}

export function TaskForm({
  projects,
  profiles,
  initialData,
  defaultStatus = "todo",
  defaultAssigneeId,
  defaultProjectId,
  onSubmit,
  onCancel,
  isEditing = false,
  loading = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [projectId, setProjectId] = useState(
    initialData?.project_id || defaultProjectId || NO_PROJECT_VALUE
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialData?.status || defaultStatus
  );
  const [priority, setPriority] = useState<TaskPriority>(
    initialData?.priority || "medium"
  );
  const [dueDate, setDueDate] = useState<Date | null>(
    initialData?.due_date ? new Date(initialData.due_date) : null
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(
    initialData?.assignee_id ?? defaultAssigneeId ?? null
  );

  // Get assignable profiles based on selected project
  const effectiveProjectId = projectId === NO_PROJECT_VALUE ? null : projectId;
  const { assignableProfiles, canAssign } = useProjectAssignees(effectiveProjectId, profiles);

  // Clear assignee if project changes and current assignee is not in the new project's members
  useEffect(() => {
    if (assigneeId && !canAssign(assigneeId)) {
      setAssigneeId(null);
    }
  }, [assigneeId, canAssign]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    if (isEditing) {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate?.toISOString() || null,
        assignee_id: assigneeId,
      } as UpdateTaskInput);
    } else {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId === NO_PROJECT_VALUE ? null : projectId,
        status,
        priority,
        due_date: dueDate?.toISOString() || null,
        assignee_id: assigneeId,
      } as CreateTaskInput);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="Enter task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          placeholder="Add a description (supports **bold**, *italic*, - bullets)"
          rows={3}
          maxLength={5000}
        />
      </div>

      {/* Project (only for new tasks, optional) */}
      {!isEditing && (
        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id="project">
              <SelectValue placeholder="No project (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT_VALUE}>
                <span className="text-muted-foreground">No project</span>
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.title}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status & Priority row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as TaskStatus)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as TaskPriority)}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Due Date */}
      <div className="space-y-2">
        <Label>Due Date</Label>
        <DatePicker
          value={dueDate}
          onChange={setDueDate}
          placeholder="Set due date (optional)"
        />
      </div>

      {/* Assignee */}
      <div className="space-y-2">
        <Label>Assignee</Label>
        <AssigneeSelector
          value={assigneeId}
          onChange={setAssigneeId}
          profiles={assignableProfiles}
          placeholder="Assign to someone (optional)"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !title.trim()}
        >
          {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
