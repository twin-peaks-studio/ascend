"use client";

import { useWorkspaceContext } from "@/contexts/workspace-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkspaceSection() {
  const { activeWorkspace, workspaces, setActiveWorkspaceId } =
    useWorkspaceContext();

  if (workspaces.length === 0) return null;

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Default Workspace</h3>
        <p className="text-sm text-muted-foreground mt-1">
          The workspace pre-selected when you create a new task.
        </p>
      </div>

      <Select
        value={activeWorkspace?.id ?? ""}
        onValueChange={setActiveWorkspaceId}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id}>
              {ws.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
