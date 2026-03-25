"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Target,
  Calendar,
  Package,
  Rocket,
  User,
  Plus,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { TaskListItem } from "@/components/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { TaskDialog } from "@/components/task";
import { cn } from "@/lib/utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import { sortTasks } from "@/lib/task-sort";
import { ENTITY_TYPE_COLORS } from "@/lib/utils/entity-colors";
import { useProject, useProjectMutations } from "@/hooks/use-projects";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { useLinkEntitiesToTask } from "@/hooks/use-link-entities-to-task";
import { useEntities } from "@/hooks/use-entities";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { Task, TaskStatus, Project } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";

interface GoalDetailPageProps {
  projectId: string;
  workspaceId: string | null;
}

export function GoalDetailPage({ projectId, workspaceId }: GoalDetailPageProps) {
  const router = useRouter();
  const { project, setProject, loading, refetch } = useProject(projectId);
  const { profiles } = useProfiles();
  const { user } = useAuth();
  const { updateProject, deleteProject, loading: projectMutationLoading } = useProjectMutations();
  const { createTask, updateTask, loading: taskMutationLoading } = useTaskMutations();
  const { trackCreatedTask, linkEntities } = useLinkEntitiesToTask();
  const { activeWorkspace } = useWorkspaceContext();
  const { entities } = useEntities(activeWorkspace?.id ?? "");

  const linkedEntity = useMemo(() => {
    if (!project?.entity_id) return null;
    return entities.find((e) => e.id === project.entity_id) ?? null;
  }, [project?.entity_id, entities]);

  const EntityIcon = linkedEntity?.entity_type === "initiative"
    ? Rocket
    : linkedEntity?.entity_type === "stakeholder"
    ? User
    : Package;

  const entityColors = linkedEntity
    ? ENTITY_TYPE_COLORS[linkedEntity.entity_type] || ENTITY_TYPE_COLORS.product
    : null;

  // Tasks
  const allTasks = useMemo(() => {
    if (!project?.tasks) return [];
    return sortTasks(project.tasks.filter((t) => !t.is_archived), "priority", "desc");
  }, [project]);

  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const totalCount = allTasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const overdue = project?.due_date
    && isOverdue(project.due_date)
    && project.status !== "completed";

  // Inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setTitle(project?.title ?? "");
    setDescription(project?.description ?? "");
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }

  const [hasInitialized, setHasInitialized] = useState(false);
  if (project && !hasInitialized) {
    setHasInitialized(true);
    setTitle(project.title);
    setDescription(project.description ?? "");
  }

  // Dialog state
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);

  const handleTitleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== project?.title) {
      await updateProject(projectId, { title: trimmed });
    } else {
      setTitle(project?.title ?? "");
    }
    setIsEditingTitle(false);
  }, [title, project, projectId, updateProject]);

  const handleDescriptionSave = useCallback(async () => {
    const newDesc = description.trim() || null;
    if (newDesc !== (project?.description || null)) {
      await updateProject(projectId, { description: newDesc });
    } else {
      setDescription(project?.description ?? "");
    }
    setIsEditingDescription(false);
  }, [description, project, projectId, updateProject]);

  const handleDueDateChange = useCallback(async (date: Date | null) => {
    const dueDate = date ? date.toISOString() : null;
    const result = await updateProject(projectId, { due_date: dueDate });
    if (result) {
      setProject((prev) => prev ? { ...prev, due_date: dueDate } : null);
    }
  }, [projectId, updateProject, setProject]);

  const handleDeleteGoal = useCallback(async () => {
    await deleteProject(projectId);
    router.push(workspaceId ? `/workspaces/${workspaceId}` : "/projects");
  }, [projectId, deleteProject, router, workspaceId]);

  const handleCreateTask = useCallback(async (data: CreateTaskInput | UpdateTaskInput) => {
    const result = await createTask(data as CreateTaskInput);
    if (result) trackCreatedTask(result);
    refetch();
  }, [createTask, refetch, trackCreatedTask]);

  const handleTaskStatusToggle = useCallback(async (task: Task) => {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    const result = await updateTask(task.id, { status: newStatus });
    if (result) {
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id ? { ...t, status: newStatus } : t
          ),
        };
      });
    }
  }, [updateTask, setProject]);

  const handleKeyDown = (e: React.KeyboardEvent, onSave: () => void, onCancel: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
    else if (e.key === "Escape") onCancel();
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="p-4 md:p-6 text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Goal not found</h2>
          <Button asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-full flex flex-col">
        {/* Top bar */}
        <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
          <Button variant="ghost" size="sm" asChild>
            <Link href={workspaceId ? `/workspaces/${workspaceId}` : "/projects"}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {workspaceId ? "Workspace" : "Projects"}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteProjectConfirm(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">
            {/* Goal header */}
            <div className="flex items-start gap-3 mb-6">
              <div className="mt-1 p-2 rounded-lg bg-violet-500/10">
                <Target className="h-6 w-6 text-violet-500" />
              </div>

              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <div className="space-y-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, handleTitleSave, () => {
                        setTitle(project.title);
                        setIsEditingTitle(false);
                      })}
                      autoFocus
                      className="!text-2xl font-bold border-0 p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleTitleSave} disabled={!title.trim() || projectMutationLoading}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setTitle(project.title); setIsEditingTitle(false); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="text-left text-2xl font-bold hover:text-muted-foreground transition-colors"
                  >
                    {title || project.title}
                  </button>
                )}
              </div>
            </div>

            {/* Meta row: entity + due date */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              {linkedEntity && entityColors && (
                <span className={cn("inline-flex items-center gap-1.5 text-sm", entityColors.text)}>
                  <EntityIcon className="h-4 w-4" />
                  {linkedEntity.name}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <Calendar className={cn("h-4 w-4", overdue ? "text-red-500" : "text-muted-foreground")} />
                <DatePicker
                  value={project.due_date ? new Date(project.due_date) : null}
                  onChange={handleDueDateChange}
                  placeholder="Set due date"
                />
              </div>
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{doneCount} of {totalCount} tasks complete</span>
                  <span className={cn(
                    "text-sm font-medium",
                    progress === 100 ? "text-green-600 dark:text-green-400" : "text-violet-600 dark:text-violet-400"
                  )}>
                    {progress}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progress === 100 ? "bg-green-500" : "bg-violet-500"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress === 100 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    All tasks complete — nice work!
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setDescription(project.description || ""); setIsEditingDescription(false); }
                    }}
                    autoFocus
                    rows={4}
                    placeholder="Add context for this goal..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleDescriptionSave} disabled={projectMutationLoading}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescription(project.description || ""); setIsEditingDescription(false); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingDescription(true)}
                  className="text-left w-full min-h-[40px] text-muted-foreground hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
                >
                  {description || project.description
                    ? <p className="text-sm text-foreground">{description || project.description}</p>
                    : <p className="text-sm">Add context for this goal...</p>
                  }
                </button>
              )}
            </div>

            {/* Tasks section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Actions
                </h3>
                <Button size="sm" variant="outline" onClick={() => setShowTaskDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </div>

              {allTasks.length > 0 ? (
                <div className="border rounded-lg divide-y">
                  {allTasks.map((task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
                      onStatusToggle={handleTaskStatusToggle}
                      assignee={profiles.find((p) => p.id === task.assignee_id) || null}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm mb-1">No tasks yet</p>
                  <p className="text-xs">Break this goal into specific actions</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowTaskDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add first task
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        projects={[project as Project]}
        profiles={profiles}
        defaultStatus="todo"
        defaultAssigneeId={user?.id ?? null}
        defaultProjectId={projectId}
        onSubmit={handleCreateTask}
        loading={taskMutationLoading}
        onEntitiesSelected={linkEntities}
      />

      {/* Delete confirmation */}
      <DeleteConfirmationDialog
        open={deleteProjectConfirm}
        onOpenChange={setDeleteProjectConfirm}
        onConfirm={handleDeleteGoal}
        title="Delete Goal"
        description={`Are you sure you want to delete "${project.title}"? This will also delete all its tasks. This action cannot be undone.`}
      />
    </AppShell>
  );
}
