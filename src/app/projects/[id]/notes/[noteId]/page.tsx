"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/shared";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useProject } from "@/hooks/use-projects";
import { useNote, useNoteMutations } from "@/hooks/use-notes";
import { useTaskMutations } from "@/hooks/use-tasks";
import { QuickAddNoteTask, NoteAttachmentsSection } from "@/components/note";
import { TaskListItem } from "@/components/task";
import { TaskExtractionDialog } from "@/components/ai";
import { useTaskExtraction } from "@/hooks/use-task-extraction";
import type { Task, TaskStatus, TaskWithProject } from "@/types";

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const noteId = params.noteId as string;

  const { project, loading: projectLoading } = useProject(projectId);
  const { note, setNote, loading: noteLoading } = useNote(noteId);
  const {
    updateNote,
    deleteNote,
    createTaskFromNote,
    loading: noteMutationLoading,
  } = useNoteMutations();
  const { updateTask } = useTaskMutations();

  // Task extraction hook
  const taskExtraction = useTaskExtraction();

  // Local editing state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Task extraction dialog state
  const [showExtractionDialog, setShowExtractionDialog] = useState(false);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track initialized note ID to prevent re-syncing on refetch
  const initializedNoteIdRef = useRef<string | null>(null);

  // Initialize local state from note ONLY when switching to a different note
  // This prevents cursor position loss during auto-save refetches
  useEffect(() => {
    if (note && note.id !== initializedNoteIdRef.current) {
      initializedNoteIdRef.current = note.id;
      // Valid use: syncing local state when note changes (prevents cursor position loss)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(note.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent(note.content || "");
    }
  }, [note]);

  // Auto-save content changes with debounce
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(async () => {
        if (note && newContent !== note.content) {
          await updateNote(noteId, { content: newContent }, projectId);
        }
      }, 1500); // 1.5 second debounce
    },
    [note, noteId, updateNote]
  );

  // Immediate save used by extraction append (bypasses debounce)
  const handleSaveContent = useCallback(
    async (nId: string, newContent: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      await updateNote(nId, { content: newContent }, projectId);
    },
    [updateNote, projectId]
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
    if (trimmedTitle && note && trimmedTitle !== note.title) {
      const updated = await updateNote(noteId, { title: trimmedTitle }, projectId);
      if (updated) {
        setNote((prev) => (prev ? { ...prev, title: trimmedTitle } : prev));
      }
    } else if (note) {
      setTitle(note.title);
    }
    setIsEditingTitle(false);
  }, [title, note, noteId, updateNote, setNote]);

  // Handle task status toggle
  const handleTaskStatusToggle = useCallback(
    async (task: Task | TaskWithProject) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      const result = await updateTask(task.id, { status: newStatus });
      if (result) {
        // Optimistically update local state, preserving current content/title
        setNote((prev) => {
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
    [updateTask, setNote, content, title]
  );

  // Handle create task from note
  const handleCreateTask = useCallback(
    async (taskTitle: string) => {
      if (!note) return;

      const newTask = await createTaskFromNote(noteId, projectId, {
        title: taskTitle,
      });

      if (newTask) {
        // Add the new task to local state, preserving current content/title
        setNote((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content, // Preserve current content state
            title: title, // Preserve current title state
            // newTask is a plain Task; add project/assignee stubs for type compatibility.
            // The note query refetch will replace this with the full TaskWithProject.
            tasks: [{ ...newTask, project: null, assignee: null } as TaskWithProject, ...prev.tasks],
          };
        });
      }
    },
    [note, noteId, projectId, createTaskFromNote, setNote, content, title]
  );

  // Handle opening task details - navigate to task page
  const handleOpenTaskDetails = useCallback(
    (task: Task | TaskWithProject) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  // Handle delete note
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const success = await deleteNote(noteId, projectId);
    if (success) {
      router.push(`/projects/${projectId}`);
    } else {
      setIsDeleting(false);
    }
    setDeleteConfirm(false);
  }, [noteId, projectId, deleteNote, router]);

  // Handle AI task extraction
  const handleExtractTasks = useCallback(() => {
    setShowExtractionDialog(true);
    taskExtraction.extractFromNote(noteId, content, projectId, project?.title);
  }, [noteId, content, projectId, project?.title, taskExtraction]);

  if (projectLoading || noteLoading || isDeleting) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isDeleting ? "Deleting note..." : "Loading..."}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!project || !note) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Note not found</p>
            <Button asChild>
              <Link href={`/projects/${projectId}`}>Back to Project</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/projects/${projectId}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link
                  href={`/projects/${projectId}`}
                  className="hover:text-foreground transition-colors"
                >
                  {project.title}
                </Link>
                <span>/</span>
                <span>Notes</span>
              </div>
              {isEditingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") {
                      setTitle(note.title);
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
                  {title || note.title}
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

        {/* Content Editor */}
        <div className="mb-8">
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Start typing your notes..."
          />
          <p className="text-xs text-muted-foreground mt-2">
            Changes are saved automatically
          </p>
        </div>

        {/* Attachments Section */}
        <NoteAttachmentsSection
          noteId={noteId}
          content={content}
          onContentChange={handleContentChange}
          onSaveContent={handleSaveContent}
        />

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
              Tasks from this Note
              {note.tasks.length > 0 && (
                <span className="text-xs font-normal">({note.tasks.length})</span>
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
              {/* Task list - no limit, shows all tasks */}
              {note.tasks.length > 0 && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  {note.tasks.map((task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      onTaskClick={handleOpenTaskDetails}
                      onStatusToggle={handleTaskStatusToggle}
                    />
                  ))}
                </div>
              )}

              {/* Quick add task */}
              <QuickAddNoteTask
                onSubmit={handleCreateTask}
                loading={noteMutationLoading}
                placeholder="Add a task from this note..."
              />

              {note.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tasks you create here will be linked to this note and the project
                </p>
              )}
            </div>
          )}
        </div>

        {/* Last updated info */}
        <div className="mt-8 pt-4 border-t border-border/40 text-xs text-muted-foreground">
          Last updated:{" "}
          {new Date(note.updated_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Note"
        description={`Are you sure you want to delete "${note.title}"? This action cannot be undone. Tasks linked to this note will remain but will be unlinked.`}
      />

      {/* AI Task Extraction Dialog */}
      <TaskExtractionDialog
        open={showExtractionDialog}
        onOpenChange={setShowExtractionDialog}
        extraction={taskExtraction}
        onRetry={handleExtractTasks}
      />
    </AppShell>
  );
}
