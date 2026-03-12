"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, Brain, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { cn } from "@/lib/utils";

interface WorkspaceSwitcherProps {
  isCollapsed: boolean;
}

export function WorkspaceSwitcher({ isCollapsed }: WorkspaceSwitcherProps) {
  const { activeWorkspace, workspaces, setActiveWorkspaceId } =
    useWorkspaceContext();
  const [showCreate, setShowCreate] = useState(false);

  if (!activeWorkspace) return null;

  const TypeIcon =
    activeWorkspace.type === "intelligence" ? Brain : Briefcase;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
            isCollapsed && "justify-center"
          )}
        >
          <TypeIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {activeWorkspace.name}
                </p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
              className="flex items-center gap-2"
            >
              {ws.type === "intelligence" ? (
                <Brain className="h-4 w-4 shrink-0" />
              ) : (
                <Briefcase className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 truncate">{ws.name}</span>
              {ws.type === "intelligence" && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  intel
                </Badge>
              )}
              {ws.id === activeWorkspace.id && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(id) => setActiveWorkspaceId(id)}
      />
    </>
  );
}
