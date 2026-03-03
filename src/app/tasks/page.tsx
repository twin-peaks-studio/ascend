"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell, Header } from "@/components/layout";
import type { ViewMode } from "@/components/layout";
import { KanbanBoard } from "@/components/board";
import { TaskDialog, QuickAddTask, TaskListView, TaskSortSelect } from "@/components/task";
import { Button } from "@/components/ui/button";
import { parseSortOptionKey, type TaskSortField, type TaskSortDirection } from "@/lib/task-sort";
import { ProjectFilter, PROJECT_FILTER_NO_PROJECT, AssigneeFilter, ASSIGNEE_FILTER_ASSIGNED_TO_ME, ASSIGNEE_FILTER_UNASSIGNED } from "@/components/filters";
import { useTasksByStatus, useTaskMutations } from "@/hooks/use-tasks";
import { useRealtimeTasksGlobal } from "@/hooks/use-realtime-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import { useAuth } from "@/hooks/use-auth";
import type { TaskWithProject, TaskStatus, Project } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

export default function TasksPage() {
  const router = useRouter();
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

  // Enable real-time task updates globally
  useRealtimeTasksGlobal(user?.id ?? null);

  // View mode state (board or list) - persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return "list";
    const stored = localStorage.getItem("tasks-view-mode");
    if (stored === "board" || stored === "list") {
      return stored;
    }
    return "list";
  });

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("tasks-view-mode", mode);
  }, []);

  // Sort state - persisted in localStorage
  const [sortField, setSortField] = useState<TaskSortField>(() => {
    if (typeof window === 'undefined') return "position";
    const stored = localStorage.getItem("tasks-sort");
    if (stored) {
      const { field } = parseSortOptionKey(stored);
      return field;
    }
    return "position";
  });
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>(() => {
    if (typeof window === 'undefined') return "asc";
    const stored = localStorage.getItem("tasks-sort");
    if (stored) {
      const { direction } = parseSortOptionKey(stored);
      return direction;
    }
    return "asc";
  });

  // Handle sort change
  const handleSortChange = useCallback((field: TaskSortField, direction: TaskSortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    localStorage.setItem("tasks-sort", `${field}:${direction}`);
  }, []);

  // Filter state - persisted in localStorage
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem("tasks-project-filter");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem("tasks-assignee-filter");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist filter changes to localStorage
  const handleProjectsChange = useCallback((ids: string[]) => {
    setSelectedProjectIds(ids);
    localStorage.setItem("tasks-project-filter", JSON.stringify(ids));
  }, []);
  const handleAssigneesChange = useCallback((ids: string[]) => {
    setSelectedAssigneeIds(ids);
    localStorage.setItem("tasks-assignee-filter", JSON.stringify(ids));
  }, []);

  // Show/hide completed tasks state - persisted in localStorage, hidden by default
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("tasks-show-completed") === "true";
  });

  const handleShowCompletedChange = useCallback((show: boolean) => {
    setShowCompleted(show);
    localStorage.setItem("tasks-show-completed", show ? "true" : "false");
  }, []);

  // Stage 1: Filter tasks by selected projects
  const projectFilteredTasks = useMemo(() => {
    if (selectedProjectIds.length === 0) return tasks;
    return tasks.filter((task) => {
      const key = task.project_id ?? PROJECT_FILTER_NO_PROJECT;
      return selectedProjectIds.includes(key);
    });
  }, [tasks, selectedProjectIds]);

  // Stage 2: Filter by assignee
  const assigneeFilteredTasks = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return projectFilteredTasks;
    return projectFilteredTasks.filter((task) =>
      selectedAssigneeIds.some((id) => {
        if (id === ASSIGNEE_FILTER_ASSIGNED_TO_ME) return task.assignee_id === user?.id;
        if (id === ASSIGNEE_FILTER_UNASSIGNED) return task.assignee_id === null;
        return task.assignee_id === id;
      })
    );
  }, [projectFilteredTasks, selectedAssigneeIds, user?.id]);

  // Stage 3: Filter out completed tasks (unless showCompleted is true)
  const filteredTasks = useMemo(() => {
    if (showCompleted) return assigneeFilteredTasks;
    return assigneeFilteredTasks.filter((task) => task.status !== "done");
  }, [assigneeFilteredTasks, showCompleted]);

  // Scope assignee profiles to selected projects (when project filter is active)
  const currentUserId = user?.id ?? null;
  const assigneeFilterProfiles = useMemo(() => {
    if (selectedProjectIds.length === 0) return profiles;
    const relevantAssigneeIds = new Set<string>();
    for (const task of projectFilteredTasks) {
      if (task.assignee_id) relevantAssigneeIds.add(task.assignee_id);
    }
    if (currentUserId) relevantAssigneeIds.add(currentUserId);
    return profiles.filter((p) => relevantAssigneeIds.has(p.id));
  }, [profiles, selectedProjectIds, projectFilteredTasks, currentUserId]);

  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
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

  // Handle open task details (click on card) - navigate to task page
  // Pass from=tasks so the task detail page returns here on delete
  const handleOpenDetails = useCallback((task: TaskWithProject) => {
    router.push(`/tasks/${task.id}?from=tasks`);
  }, [router]);

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
      onProjectsChange={handleProjectsChange}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={handleSortChange}
      assigneeProfiles={assigneeFilterProfiles}
      assigneeTasks={projectFilteredTasks}
      selectedAssigneeIds={selectedAssigneeIds}
      onAssigneesChange={handleAssigneesChange}
      currentUserId={user?.id ?? null}
      showCompleted={showCompleted}
      onShowCompletedChange={handleShowCompletedChange}
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
          <div className="flex items-center gap-2">
            <ProjectFilter
              projects={projects as Project[]}
              tasks={tasks}
              selectedProjectIds={selectedProjectIds}
              onProjectsChange={handleProjectsChange}
            />
            <AssigneeFilter
              profiles={assigneeFilterProfiles}
              tasks={projectFilteredTasks}
              selectedAssigneeIds={selectedAssigneeIds}
              onAssigneesChange={handleAssigneesChange}
              currentUserId={user?.id ?? null}
            />
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 gap-1.5 text-xs", showCompleted && "bg-primary/10 border-primary/30")}
              onClick={() => handleShowCompletedChange(!showCompleted)}
            >
              <Eye className="h-3.5 w-3.5" />
              Completed
            </Button>
          </div>
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
            showCompleted={showCompleted}
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
