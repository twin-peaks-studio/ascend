"use client";

/**
 * Capture Detail Page
 *
 * Mirrors the note detail page layout:
 * - Inline title editing with auto-save
 * - Rich text editor (Tiptap) with auto-save
 * - Capture metadata (type, date, project)
 * - Linked tasks section with inline task creation
 * - AI task extraction ("Extract Tasks with AI")
 *
 * Key difference from notes: captures are workspace-scoped (project is optional),
 * so inline task creation requires the user to pick a project.
 */

import { useState, useCallback, useEffect, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  MessageSquare,
  FileText,
  Image,
  Lightbulb,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/shared";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { QuickAddNoteTask } from "@/components/note";
import { TaskListItem } from "@/components/task";
import { TaskExtractionDialog } from "@/components/ai";
import { useCapture, useCaptureMutations } from "@/hooks/use-captures";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useTaskExtraction } from "@/hooks/use-task-extraction";
import { useEntities } from "@/hooks/use-entities";
import { useMentionSync } from "@/hooks/use-entity-mentions";
import { parseEntityMentions } from "@/lib/tiptap/entity-mention-extension";
import { getClient } from "@/lib/supabase/client-manager";
import type { ExtractionEntity } from "@/lib/ai/types";
import type { Task, TaskStatus, TaskWithProject, CaptureWithRelations } from "@/types";
import type { CaptureType } from "@/types/database";

const CAPTURE_TYPES: { value: CaptureType; label: string; icon: React.ElementType }[] = [
  { value: "meeting_note", label: "Meeting Note", icon: MessageSquare },
  { value: "document", label: "Document", icon: FileText },
  { value: "media", label: "Media", icon: Image },
  { value: "thought", label: "Thought", icon: Lightbulb },
];

interface CaptureDetailPageProps {
  params: Promise<{ id: string }>;
}

function CaptureDetailContent({ captureId }: { captureId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlWorkspaceId = searchParams.get("workspace");
  const { activeWorkspace } = useWorkspaceContext();
  const { capture, setCapture, loading: captureLoading } = useCapture(captureId);

  // Prefer the capture's own workspace_id, then URL param, then context
  const effectiveWorkspaceId = capture?.workspace_id ?? urlWorkspaceId ?? activeWorkspace?.id;
  const { entities: workspaceEntities } = useEntities(effectiveWorkspaceId ?? null);
  const allEntitiesForExtraction: ExtractionEntity[] = workspaceEntities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.entity_type as ExtractionEntity["type"],
    foundationalContext: e.foundational_context,
  }));

  // Back URL: return to workspace if we came from one
  const backWorkspaceId = urlWorkspaceId ?? activeWorkspace?.id;
  const backUrl = backWorkspaceId ? `/workspaces/${backWorkspaceId}` : "/workspaces";
  const {
    updateCapture,
    deleteCapture,
    createTaskFromCapture,
    loading: captureMutationLoading,
  } = useCaptureMutations();
  const { updateTask } = useTaskMutations();
  const { projects } = useProjects(effectiveWorkspaceId);
  const taskExtraction = useTaskExtraction();
  const { syncMentions } = useMentionSync();

  // Local editing state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExtractionDialog, setShowExtractionDialog] = useState(false);

  // Task creation: user must pick a project for inline tasks
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track initialized capture ID to prevent re-syncing on refetch
  const initializedCaptureIdRef = useRef<string | null>(null);

  const activeProjects = projects.filter((p) => p.status !== "archived");

  // Initialize local state from capture ONLY when switching to a different capture
  useEffect(() => {
    if (capture && capture.id !== initializedCaptureIdRef.current) {
      initializedCaptureIdRef.current = capture.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(capture.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent(capture.content || "");
      // Default task project to capture's linked project
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskProjectId(capture.project_id ?? null);
    }
  }, [capture]);

  // Auto-save content changes with debounce
  const handleContentChange = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    (newContent: string) => {
      setContent(newContent);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (capture && newContent !== capture.content) {
          await updateCapture(
            captureId,
            { content: newContent },
            effectiveWorkspaceId
          );

          // Sync #entity mentions after save
          if (effectiveWorkspaceId) {
            const mentions = parseEntityMentions(newContent);
            await syncMentions(
              "capture",
              captureId,
              effectiveWorkspaceId,
              mentions.map((m) => m.entityId)
            );
          }
        }
      }, 1500);
    },
    [capture, captureId, updateCapture, effectiveWorkspaceId, syncMentions]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle title save
  const handleTitleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle && capture && trimmedTitle !== capture.title) {
      const updated = await updateCapture(
        captureId,
        { title: trimmedTitle },
        effectiveWorkspaceId
      );
      if (updated) {
        setCapture((prev: CaptureWithRelations | null) =>
          prev ? { ...prev, title: trimmedTitle } : prev
        );
      }
    } else if (capture) {
      setTitle(capture.title);
    }
    setIsEditingTitle(false);
  }, [title, capture, captureId, updateCapture, setCapture, effectiveWorkspaceId]);

  // Handle metadata changes (type, date, project)
  const handleMetadataChange = useCallback(
    async (field: string, value: string | null) => {
      if (!capture) return;

      const updateData: Record<string, string | null> = {};
      if (field === "capture_type") updateData.capture_type = value;
      if (field === "project_id") updateData.project_id = value;
      if (field === "occurred_at") {
        updateData.occurred_at = value
          ? new Date(value).toISOString()
          : null;
      }

      await updateCapture(captureId, updateData, effectiveWorkspaceId);
    },
    [capture, captureId, updateCapture, effectiveWorkspaceId]
  );

  // Handle task status toggle
  const handleTaskStatusToggle = useCallback(
    async (task: Task | TaskWithProject) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      const result = await updateTask(task.id, { status: newStatus });
      if (result) {
        setCapture((prev: CaptureWithRelations | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content,
            title: title,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? { ...t, status: newStatus } : t
            ),
          };
        });
      }
    },
    [updateTask, setCapture, content, title]
  );

  // Handle create task from capture
  const handleCreateTask = useCallback(
    async (taskTitle: string) => {
      if (!capture || !taskProjectId) return;

      const newTask = await createTaskFromCapture(captureId, taskProjectId, {
        title: taskTitle,
      });

      if (newTask) {
        setCapture((prev: CaptureWithRelations | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content,
            title: title,
            tasks: [
              { ...newTask, project: null, assignee: null } as TaskWithProject,
              ...prev.tasks,
            ],
          };
        });
      }
    },
    [capture, captureId, taskProjectId, createTaskFromCapture, setCapture, content, title]
  );

  // Handle opening task details
  const handleOpenTaskDetails = useCallback(
    (task: Task | TaskWithProject) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  // Handle delete capture
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const success = await deleteCapture(captureId, effectiveWorkspaceId);
    if (success) {
      router.push(backUrl);
    } else {
      setIsDeleting(false);
    }
    setDeleteConfirm(false);
  }, [captureId, deleteCapture, router, backUrl, effectiveWorkspaceId]);

  // Handle AI task extraction — resolve entity mentions before calling API
  const handleExtractTasks = useCallback(async () => {
    setShowExtractionDialog(true);

    // Resolve entities mentioned in this capture via entity_mentions table
    let entities: ExtractionEntity[] = [];
    try {
      const supabase = getClient();
      const { data: mentions } = await supabase
        .from("entity_mentions")
        .select("entity_id")
        .eq("source_type", "capture")
        .eq("source_id", captureId);

      if (mentions && mentions.length > 0) {
        const entityIds = [...new Set(mentions.map((m: { entity_id: string }) => m.entity_id))];
        const { data: entityRows } = await supabase
          .from("entities")
          .select("id, name, entity_type, foundational_context")
          .in("id", entityIds);

        if (entityRows) {
          entities = entityRows.map((e: { id: string; name: string; entity_type: string; foundational_context: string | null }) => ({
            id: e.id,
            name: e.name,
            type: e.entity_type as ExtractionEntity["type"],
            foundationalContext: e.foundational_context,
          }));
        }
      }
    } catch {
      // Non-blocking — extraction works without entities
    }

    taskExtraction.extractFromCapture(
      captureId,
      content,
      capture?.project_id ?? undefined,
      capture?.project?.title,
      entities
    );
  }, [captureId, content, capture?.project_id, capture?.project?.title, taskExtraction]);

  if (captureLoading || isDeleting) {
    return (
      <>
        <Header title="Loading..." />
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isDeleting ? "Deleting capture..." : "Loading..."}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!capture) {
    return (
      <>
        <Header title="Not Found" />
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Capture not found</p>
            <Button asChild>
              <Link href={backUrl}>Back to Workspace</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const captureTypeConfig = CAPTURE_TYPES.find(
    (t) => t.value === capture.capture_type
  );
  const CaptureIcon = captureTypeConfig?.icon ?? Lightbulb;

  // Occurred_at in datetime-local format
  const occurredAtLocal = capture.occurred_at
    ? new Date(capture.occurred_at).toISOString().slice(0, 16)
    : "";

  return (
    <>
      <Header title={capture.title} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={backUrl}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link
                  href={backUrl}
                  className="hover:text-foreground transition-colors"
                >
                  Workspace
                </Link>
                <span>/</span>
                <span className="flex items-center gap-1">
                  <CaptureIcon className="h-3.5 w-3.5" />
                  {captureTypeConfig?.label ?? "Capture"}
                </span>
              </div>
              {isEditingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") {
                      setTitle(capture.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="!text-2xl font-bold h-auto py-1 px-2 -ml-2"
                  autoFocus
                  maxLength={200}
                />
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="text-2xl font-bold hover:bg-muted/50 rounded px-2 py-1 -ml-2 transition-colors text-left"
                >
                  {title || capture.title}
                </button>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Capture metadata row */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Capture type */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={capture.capture_type ?? "thought"}
              onValueChange={(v) => handleMetadataChange("capture_type", v)}
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
              value={occurredAtLocal}
              onChange={(e) => handleMetadataChange("occurred_at", e.target.value)}
              className="w-[200px] h-9"
            />
          </div>

          {/* Project link */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select
              value={capture.project_id ?? "__none__"}
              onValueChange={(v) =>
                handleMetadataChange("project_id", v === "__none__" ? null : v)
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

        {/* Content Editor */}
        <div className="mb-8">
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Start typing your capture... Use # to mention entities"
            workspaceId={effectiveWorkspaceId}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Changes are saved automatically
          </p>
        </div>

        {/* Tasks Section */}
        <div className="border-t border-border/40 pt-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowTasks(!showTasks)}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              {showTasks ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Tasks from this Capture
              {capture.tasks.length > 0 && (
                <span className="text-xs font-normal">({capture.tasks.length})</span>
              )}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExtractTasks}
              disabled={!content.trim() || taskExtraction.status === "extracting"}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Extract Tasks with AI
            </Button>
          </div>

          {showTasks && (
            <div className="space-y-3">
              {/* Task list */}
              {capture.tasks.length > 0 && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  {capture.tasks.map((task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      onTaskClick={handleOpenTaskDetails}
                      onStatusToggle={handleTaskStatusToggle}
                    />
                  ))}
                </div>
              )}

              {/* Project selector for inline task creation */}
              {activeProjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Create tasks in:
                  </Label>
                  <Select
                    value={taskProjectId ?? "__none__"}
                    onValueChange={(v) =>
                      setTaskProjectId(v === "__none__" ? null : v)
                    }
                  >
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select project...</SelectItem>
                      {activeProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quick add task */}
              {taskProjectId ? (
                <QuickAddNoteTask
                  onSubmit={handleCreateTask}
                  loading={captureMutationLoading}
                  placeholder="Add a task from this capture..."
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Select a project above to create tasks
                </p>
              )}

              {capture.tasks.length === 0 && taskProjectId && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tasks you create here will be linked to this capture and the selected project
                </p>
              )}
            </div>
          )}
        </div>

        {/* Date info */}
        <div className="mt-8 pt-4 border-t border-border/40 text-xs text-muted-foreground space-y-1">
          <div>
            Created:{" "}
            {new Date(capture.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          <div>
            Last updated:{" "}
            {new Date(capture.updated_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Capture"
        description={`Are you sure you want to delete "${capture.title}"? This action cannot be undone. Tasks linked to this capture will remain but will be unlinked.`}
      />

      {/* AI Task Extraction Dialog */}
      <TaskExtractionDialog
        open={showExtractionDialog}
        onOpenChange={setShowExtractionDialog}
        extraction={taskExtraction}
        onRetry={handleExtractTasks}
        projects={activeProjects.map((p) => ({ id: p.id, title: p.title }))}
        entities={taskExtraction.sourceEntities}
        allEntities={allEntitiesForExtraction}
      />
    </>
  );
}

export default function CaptureDetailPage({ params }: CaptureDetailPageProps) {
  const { id } = use(params);

  return (
    <AppShell>
      <CaptureDetailContent captureId={id} />
    </AppShell>
  );
}
