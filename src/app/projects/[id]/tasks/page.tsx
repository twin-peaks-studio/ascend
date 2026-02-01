"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import type { ViewMode } from "@/components/layout";
import { KanbanBoard } from "@/components/board";
import { TaskDialog, TaskDetailsResponsive, QuickAddTask, TaskListView } from "@/components/task";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-projects";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import type { TaskWithProject, TaskStatus, Project, Task } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { project, setProject, loading, refetch } = useProject(projectId);
  const { profiles } = useProfiles();
  const isMobile = useIsMobile();
  const {
    createTask,
    updateTask,
    updateTaskPosition,
    deleteTask,
    archiveTask,
    markAsDuplicate,
    loading: mutationLoading,
  } = useTaskMutations();

  // View mode state (board or list) - persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Load view mode preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("project-tasks-view-mode");
    if (stored === "board" || stored === "list") {
      // Using a setTimeout to avoid the cascading renders warning
      queueMicrotask(() => setViewMode(stored));
    }
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("project-tasks-view-mode", mode);
  }, []);

  // Convert project tasks to TaskWithProject format
  const tasks: TaskWithProject[] = useMemo(() => {
    if (!project) return [];
    return project.tasks.map((task) => ({
      ...task,
      project: project as Project,
    }));
  }, [project]);

  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Handle task creation
  const handleCreateTask = useCallback(
    async (data: CreateTaskInput | UpdateTaskInput) => {
      const result = await createTask({
        ...data,
        project_id: projectId,
      } as CreateTaskInput);
      if (result) {
        refetch();
      }
    },
    [createTask, refetch, projectId]
  );

  // Handle task update
  const handleUpdateTask = useCallback(
    async (data: CreateTaskInput | UpdateTaskInput) => {
      if (!editingTask) return;
      const result = await updateTask(editingTask.id, data as UpdateTaskInput);
      if (result) {
        refetch();
        setEditingTask(null);
      }
    },
    [editingTask, updateTask, refetch]
  );

  // Handle task position change (drag-drop)
  const handleTaskMove = useCallback(
    async (
      taskId: string,
      newStatus: TaskStatus,
      newPosition: number
    ): Promise<boolean> => {
      const success = await updateTaskPosition(taskId, newStatus, newPosition);
      if (success) {
        refetch();
      }
      return success;
    },
    [updateTaskPosition, refetch]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm || !project) return;

    // Store the task for potential rollback
    const taskToDelete = project.tasks.find((t) => t.id === deleteConfirm);

    // Optimistically remove the task
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== deleteConfirm),
      };
    });
    setDeleteConfirm(null);

    // Attempt the actual deletion
    const success = await deleteTask(deleteConfirm);
    if (!success && taskToDelete) {
      // Rollback on failure - restore the task
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: [...prev.tasks, taskToDelete],
        };
      });
    }
  }, [deleteConfirm, deleteTask, project, setProject]);

  // Handle archive
  const handleArchive = useCallback(
    async (taskId: string) => {
      if (!project) return;

      // Store the task for potential rollback
      const taskToArchive = project.tasks.find((t) => t.id === taskId);

      // Optimistically remove the task (archived tasks don't show in list)
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        };
      });

      const success = await archiveTask(taskId);
      if (!success && taskToArchive) {
        // Rollback on failure
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: [...prev.tasks, taskToArchive],
          };
        });
      }
    },
    [archiveTask, project, setProject]
  );

  // Handle mark as duplicate
  const handleMarkDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean) => {
      // Optimistically update the task
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, is_duplicate: isDuplicate } : t
          ),
        };
      });

      const success = await markAsDuplicate(taskId, isDuplicate);
      if (!success) {
        // Rollback on failure
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, is_duplicate: !isDuplicate } : t
            ),
          };
        });
      }
    },
    [markAsDuplicate, setProject]
  );

  // Handle add task (from column header or list view)
  const handleAddTask = useCallback((status: TaskStatus) => {
    setDefaultStatus(status);
    setEditingTask(null);
    if (isMobile) {
      setShowQuickAdd(true);
    } else {
      setShowTaskDialog(true);
    }
  }, [isMobile]);

  // Handle task status toggle (for list view)
  const handleStatusToggle = useCallback(
    async (task: TaskWithProject) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      const result = await updateTask(task.id, { status: newStatus });
      if (result) {
        // Optimistically update the project's tasks list
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
    },
    [updateTask, setProject]
  );

  // Handle edit task
  const handleEditTask = useCallback((task: TaskWithProject) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  }, []);

  // Handle open task details (click on card)
  const handleOpenDetails = useCallback((task: TaskWithProject | Task) => {
    // Ensure we have TaskWithProject format
    const taskWithProject: TaskWithProject = 'project' in task
      ? task
      : { ...task, project: project as Project };
    setSelectedTask(taskWithProject);
    setShowDetailsDialog(true);
  }, [project]);

  // Handle task update from details dialog
  const handleDetailsUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!selectedTask) return;
      const result = await updateTask(selectedTask.id, data);
      if (result) {
        const updatedTask = { ...selectedTask, ...data } as TaskWithProject;

        // Update selectedTask so the dialog shows correct values
        setSelectedTask(updatedTask);

        // Optimistically update the project's tasks list
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === selectedTask.id ? { ...t, ...data } : t
            ),
          };
        });
      }
    },
    [selectedTask, updateTask, setProject]
  );

  // Handle quick add task (from mobile + button)
  const handleQuickAddSubmit = useCallback(
    async (data: CreateTaskInput) => {
      const result = await createTask({
        ...data,
        project_id: projectId,
      });
      if (result) {
        refetch();
      }
    },
    [createTask, refetch, projectId]
  );

  const handleQuickCreate = () => {
    setDefaultStatus("todo");
    setEditingTask(null);
    if (isMobile) {
      setShowQuickAdd(true);
    } else {
      setShowTaskDialog(true);
    }
  };

  // Setter for tasks (for KanbanBoard compatibility)
  const setTasks = useCallback((updater: React.SetStateAction<TaskWithProject[]>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const currentTasks = prev.tasks.map((t) => ({ ...t, project: prev as Project }));
      const newTasks = typeof updater === 'function' ? updater(currentTasks) : updater;
      return {
        ...prev,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        tasks: newTasks.map(({ project: _proj, ...t }) => t as Task),
      };
    });
  }, [setProject]);

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
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
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
    <AppShell
      onAddTask={handleQuickCreate}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
    >
      {/* Top navigation bar */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-1.5">
            <div
              className="h-4 w-4 rounded"
              style={{ backgroundColor: project.color }}
            />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {project.title}
            </span>
          </div>
        </div>
      </div>

      <Header
        title={`${project.title} Tasks`}
        description={viewMode === "board" ? "Manage tasks with the Kanban board" : "View all project tasks"}
        onQuickCreate={handleQuickCreate}
        quickCreateLabel="New Task"
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="p-4 md:p-6">
        {viewMode === "board" ? (
          <KanbanBoard
            tasks={tasks}
            projects={[project as Project]}
            onTasksChange={setTasks}
            onTaskMove={handleTaskMove}
            onAddTask={handleAddTask}
            onEditTask={handleEditTask}
            onOpenDetails={handleOpenDetails}
            onDeleteTask={(id) => setDeleteConfirm(id)}
            onArchiveTask={handleArchive}
            onMarkDuplicate={handleMarkDuplicate}
          />
        ) : (
          <TaskListView
            tasks={tasks}
            onTaskClick={handleOpenDetails}
            onStatusToggle={handleStatusToggle}
            onAddTask={handleAddTask}
          />
        )}
      </div>

      {/* Task create/edit dialog (desktop) */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={(open) => {
          setShowTaskDialog(open);
          if (!open) setEditingTask(null);
        }}
        projects={[project as Project]}
        profiles={profiles}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        loading={mutationLoading}
      />

      {/* Quick add task drawer (mobile) */}
      <QuickAddTask
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSubmit={handleQuickAddSubmit}
        projects={[project as Project]}
        profiles={profiles}
        loading={mutationLoading}
      />

      {/* Task details dialog/drawer (responsive) */}
      <TaskDetailsResponsive
        open={showDetailsDialog}
        onOpenChange={(open) => {
          setShowDetailsDialog(open);
          if (!open) setSelectedTask(null);
        }}
        task={selectedTask}
        profiles={profiles}
        projects={[project as Project]}
        onUpdate={handleDetailsUpdate}
        onDelete={(taskId) => {
          setShowDetailsDialog(false);
          setDeleteConfirm(taskId);
        }}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />
    </AppShell>
  );
}
