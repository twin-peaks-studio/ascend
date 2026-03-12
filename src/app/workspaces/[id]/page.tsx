"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Briefcase, Brain, Settings2, Trash2 } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { ProjectCard, ProjectDialog } from "@/components/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useWorkspaceMutations } from "@/hooks/use-workspaces";
import type { ProjectStatus } from "@/types";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validation";

function WorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const { workspaces } = useWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  const { projects, loading, refetch } = useProjects(workspaceId);
  const { createProject, deleteProject, loading: mutationLoading } = useProjectMutations();
  const { deleteWorkspace, loading: wsLoading } = useWorkspaceMutations();

  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteWsConfirm, setDeleteWsConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  const filteredProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  const handleCreateProject = useCallback(
    async (data: CreateProjectInput | UpdateProjectInput) => {
      const input = data as CreateProjectInput;
      // Ensure workspace_id is set to this workspace
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

  const WsIcon = workspace?.type === "intelligence" ? Brain : Briefcase;

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
                {workspace?.type === "intelligence" ? "Intelligence" : "Standard"}
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
            <Button size="sm" className="gap-1.5" onClick={() => setShowProjectDialog(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {/* Project filter tabs */}
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
              />
            ))}
          </div>
        )}
      </div>

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
