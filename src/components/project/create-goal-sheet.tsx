"use client";

import { useState, useCallback } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectMutations } from "@/hooks/use-projects";
import { useEntities } from "@/hooks/use-entities";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { Project } from "@/types";

interface CreateGoalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (goal: Project) => void;
}

export function CreateGoalSheet({ open, onOpenChange, onCreated }: CreateGoalSheetProps) {
  const { activeWorkspace } = useWorkspaceContext();
  const { createProject, loading } = useProjectMutations();
  const { entities } = useEntities(activeWorkspace?.id ?? "");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [entityId, setEntityId] = useState<string>("");

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setDueDate(null);
    setEntityId("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !activeWorkspace) return;

    const result = await createProject({
      workspace_id: activeWorkspace.id,
      title: title.trim(),
      description: description.trim() || null,
      status: "active",
      priority: "medium",
      color: "#8b5cf6", // Purple — distinct from standard projects
      due_date: dueDate ? dueDate.toISOString() : null,
      entity_id: entityId || null,
      type: "goal",
    });

    if (result) {
      onCreated?.(result);
      reset();
      onOpenChange(false);
    }
  }, [title, description, dueDate, entityId, activeWorkspace, createProject, onCreated, reset, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" />
            New Goal
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6" onKeyDown={handleKeyDown}>
          {/* Goal name */}
          <Input
            autoFocus
            placeholder="What do you want to achieve?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none"
          />

          {/* Description */}
          <Textarea
            placeholder="Add context or details... (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />

          {/* Due date + Entity row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1">Due date</p>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Set a target date"
              />
            </div>

            {entities.length > 0 && (
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs text-muted-foreground mb-1">Linked entity</p>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to entity (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">⌘ + Enter to save</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={loading || !title.trim()}
              >
                {loading ? "Creating..." : "Create Goal"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
