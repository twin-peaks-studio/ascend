"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";
import { PROJECT_COLORS } from "@/types";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validation";

interface ProjectFormProps {
  initialData?: Partial<Project>;
  onSubmit: (data: CreateProjectInput | UpdateProjectInput) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  loading?: boolean;
}

export function ProjectForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
  loading = false,
}: ProjectFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [status, setStatus] = useState<ProjectStatus>(
    initialData?.status || "active"
  );
  const [color, setColor] = useState(initialData?.color || PROJECT_COLORS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      status,
      color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Project Name *</Label>
        <Input
          id="title"
          placeholder="Enter project name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          placeholder="Add a description (supports **bold**, *italic*, - bullets)"
          rows={3}
          maxLength={2000}
        />
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-8 w-8 rounded-full transition-all",
                "ring-2 ring-offset-2 ring-offset-background",
                color === c ? "ring-primary" : "ring-transparent hover:ring-muted"
              )}
              style={{ backgroundColor: c }}
            >
              <span className="sr-only">Select color {c}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status (only for editing) */}
      {isEditing && (
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !title.trim()}>
          {loading
            ? "Saving..."
            : isEditing
            ? "Save Changes"
            : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
