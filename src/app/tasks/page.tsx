"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell, Header } from "@/components/layout";
import type { ViewMode } from "@/components/layout";
import { KanbanBoard } from "@/components/board";
import { TaskDialog, TaskDetailsResponsive, QuickAddTask, TaskListView } from "@/components/task";
import { useTasksByStatus, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import type { TaskWithProject, TaskStatus, Project } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TasksPage() {
  const { tasks, loading, refetch, setTasks } = useTasksByStatus();
  const { projects } = useProjects();
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
  const [viewMode, setViewMode] = useState<ViewMode>("board");

  // Load view mode preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("tasks-view-mode");
    if (stored === "board" || stored === "list") {
      setViewMode(stored);
    }
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("tasks-view-mode", mode);
  }, []);

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
      const result = await createTask(data as CreateTaskInput);
      if (result) {
        refetch();
      }
    },
    [createTask, refetch]
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
      return updateTaskPosition(taskId, newStatus, newPosition);
    },
    [updateTaskPosition]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    const success = await deleteTask(deleteConfirm);
    if (success) {
      refetch();
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteTask, refetch]);

  // Handle archive
  const handleArchive = useCallback(
    async (taskId: string) => {
      const success = await archiveTask(taskId);
      if (success) {
        refetch();
      }
    },
    [archiveTask, refetch]
  );

  // Handle mark as duplicate
  const handleMarkDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean) => {
      const success = await markAsDuplicate(taskId, isDuplicate);
      if (success) {
        refetch();
      }
    },
    [markAsDuplicate, refetch]
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
        // Update local state optimistically
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: newStatus } : t
          )
        );
      }
    },
    [updateTask, setTasks]
  );

  // Handle edit task
  const handleEditTask = useCallback((task: TaskWithProject) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  }, []);

  // Handle open task details (click on card)
  const handleOpenDetails = useCallback((task: TaskWithProject) => {
    setSelectedTask(task);
    setShowDetailsDialog(true);
  }, []);

  // Handle task update from details dialog
  const handleDetailsUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!selectedTask) return;
      const result = await updateTask(selectedTask.id, data);
      if (result) {
        // If project_id is being updated, also update the project object
        let updatedProject = selectedTask.project;
        if ('project_id' in data) {
          if (data.project_id === null) {
            updatedProject = null;
          } else {
            updatedProject = projects.find(p => p.id === data.project_id) || null;
          }
        }

        const updatedTask = { ...selectedTask, ...data, project: updatedProject } as TaskWithProject;

        // Update selectedTask so the dialog shows correct values
        setSelectedTask(updatedTask);

        // Update the tasks state so the Kanban board reflects changes
        setTasks((prev) =>
          prev.map(t => t.id === selectedTask.id ? updatedTask : t)
        );
      }
    },
    [selectedTask, updateTask, projects, setTasks]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to create task
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setDefaultStatus("todo");
        setEditingTask(null);
        setShowTaskDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle quick add task (from mobile + button)
  const handleQuickAddSubmit = useCallback(
    async (data: CreateTaskInput) => {
      const result = await createTask(data);
      if (result) {
        refetch();
      }
    },
    [createTask, refetch]
  );

  const handleQuickCreate = () => {
    setDefaultStatus("todo");
    setEditingTask(null);
    // Use QuickAddTask drawer on mobile, TaskDialog on desktop
    if (isMobile) {
      setShowQuickAdd(true);
    } else {
      setShowTaskDialog(true);
    }
  };

  return (
    <AppShell onAddTask={handleQuickCreate}>
      <Header
        title="Tasks"
        description={viewMode === "board" ? "Manage your tasks with the Kanban board" : "View all your tasks"}
        onQuickCreate={handleQuickCreate}
        quickCreateLabel="New Task"
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="p-4 md:p-6">
        {loading ? (
          viewMode === "board" ? (
            <div className="flex h-[calc(100vh-10rem)] flex-nowrap gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="min-w-[280px] shrink-0 animate-pulse rounded-lg border bg-muted/30 md:min-w-0"
                />
              ))}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/30" />
                ))}
              </div>
            </div>
          )
        ) : viewMode === "board" ? (
          <KanbanBoard
            tasks={tasks}
            projects={projects as Project[]}
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
        projects={projects as Project[]}
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
        projects={projects as Project[]}
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
        projects={projects}
        onUpdate={handleDetailsUpdate}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
