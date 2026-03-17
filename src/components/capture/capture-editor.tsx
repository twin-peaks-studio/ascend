"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FileText,
  Image,
  Lightbulb,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCaptureMutations } from "@/hooks/use-captures";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjects } from "@/hooks/use-projects";
import type { CaptureWithRelations } from "@/types";
import type { CaptureType } from "@/types/database";

const CAPTURE_TYPES: { value: CaptureType; label: string; icon: React.ElementType }[] = [
  { value: "meeting_note", label: "Meeting Note", icon: MessageSquare },
  { value: "document", label: "Document", icon: FileText },
  { value: "media", label: "Media", icon: Image },
  { value: "thought", label: "Thought", icon: Lightbulb },
];

interface CaptureEditorProps {
  capture?: CaptureWithRelations | null;
  onSaved?: () => void;
  /** Explicit workspace ID — preferred over activeWorkspace from context */
  workspaceId?: string;
}

export function CaptureEditor({ capture, onSaved, workspaceId: workspaceIdProp }: CaptureEditorProps) {
  const router = useRouter();
  const { activeWorkspace } = useWorkspaceContext();
  const effectiveWorkspaceId = workspaceIdProp ?? activeWorkspace?.id;
  const { projects } = useProjects();
  const { createCapture, updateCapture, deleteCapture, loading } =
    useCaptureMutations();

  const [title, setTitle] = useState(capture?.title ?? "");
  const [content, setContent] = useState(capture?.content ?? "");
  const [captureType, setCaptureType] = useState<CaptureType>(
    (capture?.capture_type as CaptureType) ?? "thought"
  );
  const [projectId, setProjectId] = useState<string | null>(
    capture?.project_id ?? null
  );
  const [occurredAt, setOccurredAt] = useState(() => {
    if (capture?.occurred_at) {
      // Convert to datetime-local format
      const d = new Date(capture.occurred_at);
      return d.toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  });

  // Sync when capture changes (e.g. navigating between captures)
  useEffect(() => {
    if (capture) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(capture.title);
      setContent(capture.content ?? "");
      setCaptureType((capture.capture_type as CaptureType) ?? "thought");
      setProjectId(capture.project_id ?? null);
      if (capture.occurred_at) {
        setOccurredAt(new Date(capture.occurred_at).toISOString().slice(0, 16));
      }
    }
  }, [capture?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!title.trim() || !effectiveWorkspaceId) return;

    const occurredAtISO = occurredAt
      ? new Date(occurredAt).toISOString()
      : null;

    if (capture) {
      await updateCapture(
        capture.id,
        {
          title: title.trim(),
          content: content || null,
          capture_type: captureType,
          project_id: projectId,
          occurred_at: occurredAtISO,
        },
        effectiveWorkspaceId
      );
    } else {
      await createCapture({
        workspace_id: effectiveWorkspaceId,
        title: title.trim(),
        content: content || null,
        capture_type: captureType,
        project_id: projectId,
        occurred_at: occurredAtISO,
      });
    }
    onSaved?.();
  };

  const handleDelete = async () => {
    if (!capture || !effectiveWorkspaceId) return;
    const deleted = await deleteCapture(capture.id, effectiveWorkspaceId);
    if (deleted) {
      router.push("/captures");
    }
  };

  const activeProjects = projects.filter((p) => p.status !== "archived");

  return (
    <div className="space-y-4">
      {/* Back button (only in detail view) */}
      {capture && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/captures")}
          className="gap-1 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      {/* Title */}
      <Input
        placeholder="Capture title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
        maxLength={200}
        autoFocus={!capture}
      />

      {/* Meta row */}
      <div className="flex flex-wrap gap-3">
        {/* Capture type */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={captureType}
            onValueChange={(v) => setCaptureType(v as CaptureType)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAPTURE_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Date/time */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Date & Time</Label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-[200px] h-9"
          />
        </div>

        {/* Project link */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={projectId ?? "__none__"}
            onValueChange={(v) =>
              setProjectId(v === "__none__" ? null : v)
            }
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No project</SelectItem>
              {activeProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <RichTextEditor
        value={content}
        onChange={(val) => setContent(val)}
        placeholder="Write your capture..."
        minHeight={200}
        workspaceId={effectiveWorkspaceId}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={!title.trim() || loading}>
          {loading ? "Saving..." : capture ? "Update" : "Save"}
        </Button>

        {capture && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete capture?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
