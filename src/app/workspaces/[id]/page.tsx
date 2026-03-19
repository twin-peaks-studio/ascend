"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Briefcase, Brain, Trash2, FolderKanban, BookOpen, Package, Network, CheckSquare } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { ProjectCard, ProjectDialog } from "@/components/project";
import { TaskDialog } from "@/components/task";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useWorkspaceMutations } from "@/hooks/use-workspaces";
import { WorkspaceCapturesTab } from "@/components/workspace/workspace-captures-tab";
import { WorkspaceProductsTab } from "@/components/workspace/workspace-products-tab";
import { WorkspaceEntitiesTab } from "@/components/workspace/workspace-entities-tab";
import { WorkspaceTasksTab } from "@/components/workspace/workspace-tasks-tab";
import { workspaceTaskKeys } from "@/hooks/use-workspace-tasks";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { ProjectStatus, Project } from "@/types";
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput } from "@/lib/validation";

type WorkspaceTab = "projects" | "tasks" | "captures" | "products" | "entities";

function WorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const { workspaces, setActiveWorkspaceId, activeWorkspace } = useWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Sync workspace context to match the URL — ensures CaptureEditor and other
  // context-dependent components use the correct workspace
  useEffect(() => {
    if (workspaceId && activeWorkspace?.id !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaceId, activeWorkspace?.id, setActiveWorkspaceId]);

  const { projects, loading, refetch } = useProjects(workspaceId);
  const { createProject, deleteProject, loading: mutationLoading } = useProjectMutations();
  const { createTask, loading: taskMutationLoading } = useTaskMutations();
  const { profiles } = useProfiles();
  const { user } = useAuth();
  const { deleteWorkspace, loading: wsLoading } = useWorkspaceMutations();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("projects");
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteWsConfirm, setDeleteWsConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  const isIntelligence = workspace?.type === "intelligence";

  const filteredProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  const handleCreateProject = useCallback(
    async (data: CreateProjectInput | UpdateProjectInput) => {
      const input = data as CreateProjectInput;
      await createProject({ ...input, workspace_id: workspaceId });
      refetch();
    },
    [createProject, refetch, workspaceId]
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
      setDeleteConfirm(null);
      refetch();
    },
    [deleteProject, refetch]
  );

  const handleDeleteWorkspace = useCallback(async () => {
    const success = await deleteWorkspace(workspaceId);
    if (success) {
      router.push("/");
    }
  }, [deleteWorkspace, workspaceId, router]);

  const handleCreateTask = useCallback(
    async (data: CreateTaskInput) => {
      await createTask(data);
      queryClient.invalidateQueries({ queryKey: workspaceTaskKeys.list(workspaceId) });
    },
    [createTask, queryClient, workspaceId]
  );

  // Cmd+7 (Mac) / Ctrl+7 (Win/Linux) → open task creation dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "7") {
        e.preventDefault();
        setShowTaskDialog(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!workspace && !loading) {
    return (
      <>
        <Header title="Workspace Not Found" />
        <div className="px-4 lg:px-8 py-8 text-center text-muted-foreground">
          <p>This workspace doesn&apos;t exist or you don&apos;t have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
            Go to Dashboard
          </Button>
        </div>
      </>
    );
  }

  const WsIcon = isIntelligence ? Brain : Briefcase;

  const workspaceTabs: { key: WorkspaceTab; label: string; icon: React.ElementType }[] = [
    { key: "projects", label: "Projects", icon: FolderKanban },
    { key: "tasks", label: "Tasks", icon: CheckSquare },
    ...(isIntelligence
      ? [
          { key: "captures" as WorkspaceTab, label: "Captures", icon: BookOpen },
          { key: "products" as WorkspaceTab, label: "Products", icon: Package },
          { key: "entities" as WorkspaceTab, label: "Entities", icon: Network },
        ]
      : []),
  ];

  return (
    <>
      <Header title={workspace?.name ?? "Loading..."} />

      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
        {/* Workspace header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WsIcon className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">{workspace?.name}</h2>
              <Badge variant="secondary" className="mt-1">
                {isIntelligence ? "Intelligence" : "Standard"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteWsConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            {activeTab === "tasks" && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowTaskDialog(true)}>
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            )}
            {activeTab === "projects" && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowProjectDialog(true)}>
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        </div>

        {/* Workspace-level tabs (for intelligence workspaces) */}
        {workspaceTabs.length > 1 && (
          <div className="flex gap-1 border-b overflow-x-auto">
            {workspaceTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === tab.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content */}
        {activeTab === "projects" && (
          <>
            {/* Project status filter */}
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-40 rounded-lg border bg-card animate-pulse"
                  />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No projects yet</p>
                <p className="text-sm mt-1">
                  Create your first project in this workspace.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowProjectDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={() => setDeleteConfirm(project.id)}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "tasks" && (
          <WorkspaceTasksTab workspaceId={workspaceId} />
        )}

        {activeTab === "captures" && (
          <WorkspaceCapturesTab workspaceId={workspaceId} />
        )}

        {activeTab === "products" && (
          <WorkspaceProductsTab workspaceId={workspaceId} />
        )}

        {activeTab === "entities" && (
          <WorkspaceEntitiesTab workspaceId={workspaceId} />
        )}
      </div>

      {/* Create Task Dialog (Cmd+7 or "New Task" button) */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        projects={projects as Project[]}
        profiles={profiles}
        defaultStatus="todo"
        defaultAssigneeId={user?.id ?? null}
        onSubmit={handleCreateTask}
        loading={taskMutationLoading}
        workspaceId={workspaceId}
      />

      {/* Create Project Dialog */}
      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onSubmit={handleCreateProject}
        loading={mutationLoading}
        workspaceId={workspaceId}
      />

      {/* Delete Project Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) handleDeleteProject(deleteConfirm); }}
        title="Delete Project"
        description="This will permanently delete this project and all its tasks. This cannot be undone."
      />

      {/* Delete Workspace Confirmation */}
      <DeleteConfirmationDialog
        open={deleteWsConfirm}
        onOpenChange={setDeleteWsConfirm}
        onConfirm={handleDeleteWorkspace}
        title="Delete Workspace"
        description="This will permanently delete this workspace and all its projects. This cannot be undone."
      />
    </>
  );
}

export default function WorkspaceDetailPage() {
  return (
    <AppShell>
      <WorkspaceContent />
    </AppShell>
  );
}
