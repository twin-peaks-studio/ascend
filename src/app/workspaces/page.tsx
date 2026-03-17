"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Brain, Briefcase } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

function WorkspacesListContent() {
  const router = useRouter();
  const { workspaces, loading, setActiveWorkspaceId } = useWorkspaceContext();
  const [showCreate, setShowCreate] = useState(false);

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    router.push(`/workspaces/${workspaceId}`);
  };

  const handleCreated = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    router.push(`/workspaces/${workspaceId}`);
  };

  return (
    <>
      <Header title="Workspaces" />

      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Select a workspace to view its projects.
          </p>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-lg border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No workspaces yet</p>
            <p className="text-sm mt-1">
              Create your first workspace to get started.
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Workspace
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => {
              const WsIcon = ws.type === "intelligence" ? Brain : Briefcase;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceClick(ws.id)}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card text-left transition-colors hover:bg-accent hover:border-accent-foreground/20"
                >
                  <WsIcon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{ws.name}</p>
                    <Badge variant="secondary" className="mt-1.5 text-[10px]">
                      {ws.type === "intelligence" ? "Intelligence" : "Standard"}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </>
  );
}

export default function WorkspacesListPage() {
  return (
    <AppShell>
      <WorkspacesListContent />
    </AppShell>
  );
}
