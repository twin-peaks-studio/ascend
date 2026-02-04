"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AppShell, Header } from "@/components/layout";
import type { ViewMode } from "@/components/layout";
import { KanbanBoard } from "@/components/board";
import { TaskDialog, TaskDetailsResponsive, QuickAddTask, TaskListView, TaskSortSelect } from "@/components/task";
import { parseSortOptionKey, type TaskSortField, type TaskSortDirection } from "@/lib/task-sort";
import { ProjectFilter } from "@/components/filters";
import { useTasksByStatus, useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import { useAuth } from "@/hooks/use-auth";
import type { TaskWithProject, TaskStatus, Project } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

export default function TasksPage() {
  const { tasks, loading, refetch, setTasks } = useTasksByStatus();
  const { projects } = useProjects();
  const { profiles } = useProfiles();
  const isMobile = useIsMobile();
  const { user } = useAuth();
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

  // Sort state - persisted in localStorage
  const [sortField, setSortField] = useState<TaskSortField>("position");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("asc");

  // Load sort preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("tasks-sort");
    if (stored) {
      const { field, direction } = parseSortOptionKey(stored);
      setSortField(field);
      setSortDirection(direction);
    }
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((field: TaskSortField, direction: TaskSortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    localStorage.setItem("tasks-sort", `${field}:${direction}`);
  }, []);

  // Filter state - now supports multiple projects
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Filter tasks by selected projects
  const filteredTasks = useMemo(() => {
    if (selectedProjectIds.length === 0) return tasks;
    return tasks.filter((task) => task.project_id && selectedProjectIds.includes(task.project_id));
  }, [tasks, selectedProjectIds]);

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

    // Store the task for potential rollback
    const taskToDelete = tasks.find((t) => t.id === deleteConfirm);

    // Optimistically remove the task
    setTasks((prev) => prev.filter((t) => t.id !== deleteConfirm));
    setDeleteConfirm(null);

    // Attempt the actual deletion
    const success = await deleteTask(deleteConfirm);
    if (!success && taskToDelete) {
      // Rollback on failure - restore the task
      setTasks((prev) => [...prev, taskToDelete]);
    }
  }, [deleteConfirm, deleteTask, tasks, setTasks]);

  // Handle archive
  const handleArchive = useCallback(
    async (taskId: string) => {
      // Store the task for potential rollback
      const taskToArchive = tasks.find((t) => t.id === taskId);

      // Optimistically remove the task (archived tasks don't show in list)
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      const success = await archiveTask(taskId);
      if (!success && taskToArchive) {
        // Rollback on failure
        setTasks((prev) => [...prev, taskToArchive]);
      }
    },
    [archiveTask, tasks, setTasks]
  );

  // Handle mark as duplicate
  const handleMarkDuplicate = useCallback(
    async (taskId: string, isDuplicate: boolean) => {
      // Optimistically update the task
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, is_duplicate: isDuplicate } : t
        )
      );

      const success = await markAsDuplicate(taskId, isDuplicate);
      if (!success) {
        // Rollback on failure
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, is_duplicate: !isDuplicate } : t
          )
        );
      }
    },
    [markAsDuplicate, setTasks]
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
    <AppShell
      onAddTask={handleQuickCreate}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      projects={projects as Project[]}
      selectedProjectIds={selectedProjectIds}
      onProjectsChange={setSelectedProjectIds}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={handleSortChange}
    >
      <Header
        title="Tasks"
        description={viewMode === "board" ? "Manage your tasks with the Kanban board" : "View all your tasks"}
        onQuickCreate={handleQuickCreate}
        quickCreateLabel="New Task"
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="p-4 md:p-6">
        {/* Filters and sorting - desktop only, mobile uses bottom nav filter sheet */}
        <div className="mb-4 hidden items-center justify-between gap-2 lg:flex">
          <ProjectFilter
            projects={projects as Project[]}
            selectedProjectIds={selectedProjectIds}
            onProjectsChange={setSelectedProjectIds}
          />
          <TaskSortSelect
            field={sortField}
            direction={sortDirection}
            onChange={handleSortChange}
          />
        </div>

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
            tasks={filteredTasks}
            projects={projects as Project[]}
            onTasksChange={setTasks}
            onTaskMove={handleTaskMove}
            onAddTask={handleAddTask}
            onEditTask={handleEditTask}
            onOpenDetails={handleOpenDetails}
            onDeleteTask={(id) => setDeleteConfirm(id)}
            onArchiveTask={handleArchive}
            onMarkDuplicate={handleMarkDuplicate}
            sortField={sortField}
            sortDirection={sortDirection}
          />
        ) : (
          <TaskListView
            tasks={filteredTasks}
            onTaskClick={handleOpenDetails}
            onStatusToggle={handleStatusToggle}
            onAddTask={handleAddTask}
            sortField={sortField}
            sortDirection={sortDirection}
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
        defaultAssigneeId={user?.id ?? null}
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
        defaultAssigneeId={user?.id ?? null}
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
