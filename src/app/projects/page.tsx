"use client";

import { useEffect, useState, useCallback } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { ProjectCard, ProjectDialog } from "@/components/project";
import { QuickAddTask } from "@/components/task";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import type { ProjectStatus } from "@/types";
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput } from "@/lib/validation";

export default function ProjectsPage() {
  const { projects, loading, refetch } = useProjects();
  const { profiles } = useProfiles();
  const isMobile = useIsMobile();
  const {
    createProject,
    deleteProject,
    loading: mutationLoading,
  } = useProjectMutations();
  const { createTask, loading: taskMutationLoading } = useTaskMutations();

  // State
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  // Get active projects for task assignment
  const activeProjects = projects.filter((p) => p.status === "active");

  // Filter projects by status
  const filteredProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  // Handle project creation
  const handleCreateProject = useCallback(
    async (data: CreateProjectInput | UpdateProjectInput) => {
      await createProject(data as CreateProjectInput);
      refetch();
    },
    [createProject, refetch]
  );

  // Handle quick task creation (from mobile + button)
  const handleQuickAddSubmit = useCallback(
    async (data: CreateTaskInput) => {
      await createTask(data);
    },
    [createTask]
  );

  // Handle mobile add button - always opens task creation
  const handleMobileAddTask = useCallback(() => {
    if (isMobile) {
      setShowQuickAdd(true);
    } else {
      setShowProjectDialog(true);
    }
  }, [isMobile]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    await deleteProject(deleteConfirm);
    refetch();
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteProject, refetch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + P to create project
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setShowProjectDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AppShell onAddTask={handleMobileAddTask}>
      <Header
        title="Projects"
        description="Manage your projects"
        onQuickCreate={() => setShowProjectDialog(true)}
        quickCreateLabel="New Project"
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Tabs
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as ProjectStatus | "all")
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Projects grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {statusFilter === "all"
                ? "Get started by creating your first project."
                : `No ${statusFilter} projects found.`}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => setShowProjectDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => setDeleteConfirm(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project create dialog */}
      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onSubmit={handleCreateProject}
        loading={mutationLoading}
      />

      {/* Quick add task drawer (mobile) */}
      <QuickAddTask
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSubmit={handleQuickAddSubmit}
        projects={activeProjects}
        profiles={profiles}
        loading={taskMutationLoading}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will also delete its task and all documents. This action cannot be undone."
      />
    </AppShell>
  );
}
