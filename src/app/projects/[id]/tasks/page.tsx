"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell, Header } from "@/components/layout";
import type { ViewMode } from "@/components/layout";
import { KanbanBoard } from "@/components/board";
import { TaskDialog, QuickAddTask, SectionedTaskListView, TaskSortSelect } from "@/components/task";
import { parseSortOptionKey, type TaskSortField, type TaskSortDirection } from "@/lib/task-sort";
import { AssigneeFilter, ASSIGNEE_FILTER_ASSIGNED_TO_ME, ASSIGNEE_FILTER_UNASSIGNED } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-projects";
import { useProjectProducts } from "@/hooks/use-project-products";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useSections, useSectionMutations } from "@/hooks/use-sections";
import { useRealtimeTasksForProject } from "@/hooks/use-realtime-tasks";
import { useRealtimeSections } from "@/hooks/use-realtime-sections";
import { useProjectMembers } from "@/hooks/use-project-members";
import { useIsMobile } from "@/hooks/use-media-query";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { TaskWithProject, TaskStatus, Project, Task, Profile } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

export default function ProjectTasksPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { activeWorkspace } = useWorkspaceContext();
  const { project, setProject, loading, refetch } = useProject(projectId);
  const projectProducts = useProjectProducts(project?.entity_id);
  const { members: projectMembers } = useProjectMembers(projectId);
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

  // Section hooks
  const { sections, refetch: refetchSections } = useSections(projectId);
  const {
    createSection,
    updateSection,
    deleteSection: deleteSectionMutation,
    reorderSections,
    moveTaskToSection,
  } = useSectionMutations();

  // Enable real-time updates
  useRealtimeTasksForProject(projectId, user?.id ?? null);
  useRealtimeSections(projectId);

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

  // Sort state - persisted in localStorage
  const [sortField, setSortField] = useState<TaskSortField>(() => {
    if (typeof window === 'undefined') return "position";
    const stored = localStorage.getItem("project-tasks-sort");
    if (stored) {
      const { field } = parseSortOptionKey(stored);
      return field;
    }
    return "position";
  });
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>(() => {
    if (typeof window === 'undefined') return "asc";
    const stored = localStorage.getItem("project-tasks-sort");
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
    localStorage.setItem("project-tasks-sort", `${field}:${direction}`);
  }, []);

  // Convert project tasks to TaskWithProject format
  const tasks: TaskWithProject[] = useMemo(() => {
    if (!project) return [];
    return project.tasks.map((task) => ({
      ...task,
      project: project as Project,
      products: projectProducts,
    }));
  }, [project, projectProducts]);

  // Derive project-scoped profiles from project members
  const profiles: Profile[] = useMemo(() => {
    return projectMembers
      .map((m) => m.profile)
      .filter((p): p is Profile => p !== null);
  }, [projectMembers]);

  // Assignee filter state - persisted in localStorage
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem("project-tasks-assignee-filter");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist filter changes to localStorage
  const handleAssigneesChange = useCallback((ids: string[]) => {
    setSelectedAssigneeIds(ids);
    localStorage.setItem("project-tasks-assignee-filter", JSON.stringify(ids));
  }, []);

  // Show/hide completed tasks state - persisted in localStorage, hidden by default
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("project-tasks-show-completed") === "true";
  });

  const handleShowCompletedChange = useCallback((show: boolean) => {
    setShowCompleted(show);
    localStorage.setItem("project-tasks-show-completed", show ? "true" : "false");
  }, []);

  // Filter tasks by assignee
  const assigneeFilteredTasks = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return tasks;
    return tasks.filter((task) =>
      selectedAssigneeIds.some((id) => {
        if (id === ASSIGNEE_FILTER_ASSIGNED_TO_ME) return task.assignee_id === user?.id;
        if (id === ASSIGNEE_FILTER_UNASSIGNED) return task.assignee_id === null;
        return task.assignee_id === id;
      })
    );
  }, [tasks, selectedAssigneeIds, user?.id]);

  // Filter out completed tasks (unless showCompleted is true)
  const filteredTasks = useMemo(() => {
    if (showCompleted) return assigneeFilteredTasks;
    return assigneeFilteredTasks.filter((task) => task.status !== "done");
  }, [assigneeFilteredTasks, showCompleted]);

  // Collapsed sections state - persisted in localStorage
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`project-${projectId}-collapsed-sections`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const handleToggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      localStorage.setItem(
        `project-${projectId}-collapsed-sections`,
        JSON.stringify([...next])
      );
      return next;
    });
  }, [projectId]);

  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteSectionConfirm, setDeleteSectionConfirm] = useState<string | null>(null);

  // Handle task creation
  const handleCreateTask = useCallback(
    async (data: CreateTaskInput | UpdateTaskInput) => {
      // Compute section_position for tasks created in a section
      let sectionPosition = 0;
      if (defaultSectionId && project) {
        const sectionTasks = project.tasks.filter(
          (t) => t.section_id === defaultSectionId
        );
        sectionPosition = sectionTasks.length;
      }

      const result = await createTask({
        ...data,
        project_id: projectId,
        section_id: defaultSectionId,
        section_position: defaultSectionId ? sectionPosition : 0,
      } as CreateTaskInput);
      if (result) {
        refetch();
      }
    },
    [createTask, refetch, projectId, defaultSectionId, project]
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
  const handleAddTask = useCallback((status: TaskStatus, sectionId?: string | null) => {
    setDefaultStatus(status);
    setDefaultSectionId(sectionId ?? null);
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

  // Handle open task details (click on card) - navigate to task page
  const handleOpenDetails = useCallback((task: TaskWithProject | Task) => {
    router.push(`/tasks/${task.id}`);
  }, [router]);

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

  // Section handlers
  const handleCreateSection = useCallback(
    async (name: string) => {
      const position = sections.length;
      await createSection({ project_id: projectId, name, position });
      refetchSections();
    },
    [createSection, projectId, sections.length, refetchSections]
  );

  const handleRenameSection = useCallback(
    async (sectionId: string, name: string) => {
      await updateSection(sectionId, projectId, { name });
    },
    [updateSection, projectId]
  );

  const handleDeleteSectionConfirm = useCallback(async () => {
    if (!deleteSectionConfirm) return;
    await deleteSectionMutation(deleteSectionConfirm, projectId);
    setDeleteSectionConfirm(null);
    refetch();
  }, [deleteSectionConfirm, deleteSectionMutation, projectId, refetch]);

  const handleSectionReorder = useCallback(
    async (updates: Array<{ id: string; position: number }>) => {
      return reorderSections(projectId, updates);
    },
    [reorderSections, projectId]
  );

  const handleTaskMoveToSection = useCallback(
    async (
      taskId: string,
      sectionId: string | null,
      sectionPosition: number
    ) => {
      const success = await moveTaskToSection(taskId, sectionId, sectionPosition);
      if (success) {
        // Update project cache optimistically
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? { ...t, section_id: sectionId, section_position: sectionPosition }
                : t
            ),
          };
        });
      }
      return success;
    },
    [moveTaskToSection, setProject]
  );

  const handleQuickCreate = () => {
    setDefaultStatus("todo");
    setDefaultSectionId(null);
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
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={handleSortChange}
      assigneeProfiles={profiles}
      assigneeTasks={tasks}
      selectedAssigneeIds={selectedAssigneeIds}
      onAssigneesChange={handleAssigneesChange}
      currentUserId={user?.id ?? null}
      disableZeroCount={true}
      showCompleted={showCompleted}
      onShowCompletedChange={handleShowCompletedChange}
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
        {/* Filters and sorting - desktop only, mobile uses bottom nav filter sheet */}
        <div className="mb-4 hidden items-center justify-between gap-2 lg:flex">
          <div className="flex items-center gap-2">
            <AssigneeFilter
              profiles={profiles}
              tasks={tasks}
              selectedAssigneeIds={selectedAssigneeIds}
              onAssigneesChange={handleAssigneesChange}
              currentUserId={user?.id ?? null}
              disableZeroCount={true}
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

        {viewMode === "board" ? (
          <KanbanBoard
            tasks={filteredTasks}
            projects={[project as Project]}
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
          <SectionedTaskListView
            tasks={filteredTasks}
            sections={sections}
            profiles={profiles}
            collapsedSectionIds={collapsedSectionIds}
            onToggleSectionCollapse={handleToggleSectionCollapse}
            onTaskClick={handleOpenDetails}
            onStatusToggle={handleStatusToggle}
            onAddTask={handleAddTask}
            onCreateSection={handleCreateSection}
            onRenameSection={handleRenameSection}
            onDeleteSection={(id) => setDeleteSectionConfirm(id)}
            onTaskMove={handleTaskMoveToSection}
            onSectionReorder={handleSectionReorder}
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
          if (!open) {
            setEditingTask(null);
            setDefaultSectionId(null);
          }
        }}
        projects={[project as Project]}
        profiles={profiles}
        task={editingTask}
        defaultStatus={defaultStatus}
        defaultAssigneeId={user?.id ?? null}
        defaultProjectId={projectId}
        defaultSectionId={defaultSectionId}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        loading={mutationLoading}
        workspaceId={activeWorkspace?.id}
      />

      {/* Quick add task drawer (mobile) */}
      <QuickAddTask
        open={showQuickAdd}
        onOpenChange={(open) => {
          setShowQuickAdd(open);
          if (!open) setDefaultSectionId(null);
        }}
        onSubmit={handleQuickAddSubmit}
        projects={[project as Project]}
        profiles={profiles}
        loading={mutationLoading}
        defaultAssigneeId={user?.id ?? null}
        defaultProjectId={projectId}
        defaultSectionId={defaultSectionId}
      />

      {/* Delete task confirmation dialog */}
      <DeleteConfirmationDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />

      {/* Delete section confirmation dialog */}
      <DeleteConfirmationDialog
        open={!!deleteSectionConfirm}
        onOpenChange={(open) => !open && setDeleteSectionConfirm(null)}
        onConfirm={handleDeleteSectionConfirm}
        title="Delete Section"
        description="Are you sure you want to delete this section? Tasks in this section will become unsectioned. This action cannot be undone."
      />
    </AppShell>
  );
}
