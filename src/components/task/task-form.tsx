"use client";

import { useState, useEffect } from "react";
import { Package, Rocket, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { AssigneeSelector } from "@/components/task/assignee-selector";
import { EntityPickerPopover } from "@/components/shared/entity-picker-popover";
import { useProjectAssignees } from "@/hooks/use-project-assignees";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ENTITY_TYPE_COLORS } from "@/lib/utils/entity-colors";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority, Project, Profile } from "@/types";
import type { Entity } from "@/types/database";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";

const NO_PROJECT_VALUE = "__none__";
const NO_WORKSPACE_VALUE = "__none__";

const ENTITY_ICONS: Record<string, React.ElementType> = {
  product: Package,
  initiative: Rocket,
  stakeholder: User,
};

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
  /** Called after submit with selected entity IDs to link */
  onEntitiesSelected?: (entityIds: { id: string; type: string }[]) => void;
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
  onEntitiesSelected,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(NO_WORKSPACE_VALUE);
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

  // Get workspaces for the selector
  const { workspaces } = useWorkspaces();
  const effectiveWorkspaceId = selectedWorkspaceId === NO_WORKSPACE_VALUE ? null : selectedWorkspaceId;

  // Clear entities when workspace changes
  useEffect(() => {
    setSelectedEntities([]);
  }, [selectedWorkspaceId]);

  // Get assignable profiles based on selected project
  const effectiveProjectId = projectId === NO_PROJECT_VALUE ? null : projectId;
  const { assignableProfiles, canAssign } = useProjectAssignees(effectiveProjectId, profiles);

  // Clear assignee if project changes and current assignee is not in the new project's members
  // Valid use: data consistency when project changes
  useEffect(() => {
    if (assigneeId && !canAssign(assigneeId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssigneeId(null);
    }
  }, [assigneeId, canAssign]);

  const selectedEntityIds = new Set<string>(selectedEntities.map((e) => e.id));

  const handleEntityToggle = (entity: Entity, isLinked: boolean) => {
    if (isLinked) {
      setSelectedEntities((prev) => prev.filter((e) => e.id !== entity.id));
    } else {
      setSelectedEntities((prev) => [...prev, entity]);
    }
  };

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

    // Notify parent about selected entities after submit
    if (selectedEntities.length > 0 && onEntitiesSelected) {
      onEntitiesSelected(
        selectedEntities.map((e) => ({ id: e.id, type: e.entity_type }))
      );
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
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder="Add a description... Use # to mention entities"
          minHeight={80}
          workspaceId={effectiveWorkspaceId}
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

      {/* Workspace & Entities (only for creation) */}
      {!isEditing && workspaces.length > 0 && (
        <>
          {/* Workspace selector */}
          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="workspace">
                <SelectValue placeholder="Select workspace (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_WORKSPACE_VALUE}>
                  <span className="text-muted-foreground">No workspace</span>
                </SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity picker (only when workspace selected) */}
          {effectiveWorkspaceId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Entities
                <EntityPickerPopover
                  workspaceId={effectiveWorkspaceId}
                  linkedEntityIds={selectedEntityIds}
                  onToggle={handleEntityToggle}
                />
              </Label>
              {selectedEntities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntities.map((entity) => {
                    const colors = ENTITY_TYPE_COLORS[entity.entity_type];
                    const Icon = ENTITY_ICONS[entity.entity_type] || Package;
                    return (
                      <span
                        key={entity.id}
                        className={cn(
                          "inline-flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded text-xs font-medium",
                          colors.bg,
                          colors.text
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {entity.name}
                        <button
                          type="button"
                          onClick={() => setSelectedEntities((prev) => prev.filter((e) => e.id !== entity.id))}
                          className="ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">None selected</p>
              )}
            </div>
          )}
        </>
      )}

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
