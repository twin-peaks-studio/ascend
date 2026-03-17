"use client";

import { useState, useMemo } from "react";
import { Check, ChevronDown, Briefcase, Brain, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";

interface WorkspaceFilterProps {
  workspaces: Workspace[];
  selectedWorkspaceIds: string[];
  onWorkspacesChange: (workspaceIds: string[]) => void;
}

export function WorkspaceFilter({
  workspaces,
  selectedWorkspaceIds,
  onWorkspacesChange,
}: WorkspaceFilterProps) {
  const [open, setOpen] = useState(false);

  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => {
      const aSelected = selectedWorkspaceIds.includes(a.id);
      const bSelected = selectedWorkspaceIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [workspaces, selectedWorkspaceIds]);

  const toggleWorkspace = (workspaceId: string) => {
    if (selectedWorkspaceIds.includes(workspaceId)) {
      onWorkspacesChange(selectedWorkspaceIds.filter((id) => id !== workspaceId));
    } else {
      onWorkspacesChange([...selectedWorkspaceIds, workspaceId]);
    }
  };

  const clearAll = () => {
    onWorkspacesChange([]);
  };

  const hasFilter = selectedWorkspaceIds.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs",
            hasFilter && "bg-primary/10 border-primary/30"
          )}
        >
          <Briefcase className="h-3.5 w-3.5" />
          {hasFilter
            ? `${selectedWorkspaceIds.length} workspace${selectedWorkspaceIds.length > 1 ? "s" : ""}`
            : "Workspace"}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {hasFilter && (
            <button
              onClick={clearAll}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filter
            </button>
          )}
          {sortedWorkspaces.map((ws) => {
            const isSelected = selectedWorkspaceIds.includes(ws.id);
            const WsIcon = ws.type === "intelligence" ? Brain : Briefcase;

            return (
              <button
                key={ws.id}
                onClick={() => toggleWorkspace(ws.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <WsIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{ws.name}</span>
              </button>
            );
          })}
          {workspaces.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No workspaces
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
