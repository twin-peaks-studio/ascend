"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  Unlink,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/shared";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { TaskDetailsResponsive } from "@/components/task";
import { useProject } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useNote, useNoteMutations } from "@/hooks/use-notes";
import { useTaskMutations } from "@/hooks/use-tasks";
import { QuickAddNoteTask } from "@/components/note";
import { TaskExtractionDialog } from "@/components/ai";
import { useTaskExtraction } from "@/hooks/use-task-extraction";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskWithProject } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { PRIORITY_DISPLAY_SHORT } from "@/types";

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const noteId = params.noteId as string;

  const { project, loading: projectLoading } = useProject(projectId);
  const { note, setNote, loading: noteLoading } = useNote(noteId);
  const { profiles } = useProfiles();
  const {
    updateNote,
    deleteNote,
    createTaskFromNote,
    unlinkTaskFromNote,
    loading: noteMutationLoading,
  } = useNoteMutations();
  const { updateTask, deleteTask } = useTaskMutations();

  // Task extraction hook
  const taskExtraction = useTaskExtraction();

  // Local editing state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Task details dialog state
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<string | null>(null);

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
      setTitle(note.title);
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
          await updateNote(noteId, { content: newContent });
        }
      }, 1500); // 1.5 second debounce
    },
    [note, noteId, updateNote]
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
      const updated = await updateNote(noteId, { title: trimmedTitle });
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
    async (task: Task) => {
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
            tasks: [newTask, ...prev.tasks],
          };
        });
      }
    },
    [note, noteId, projectId, createTaskFromNote, setNote, content, title]
  );

  // Handle unlink task from note
  const handleUnlinkTask = useCallback(
    async (taskId: string) => {
      const success = await unlinkTaskFromNote(noteId, taskId);
      if (success) {
        // Remove task from local state, preserving current content/title
        setNote((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content,
            title: title,
            tasks: prev.tasks.filter((t) => t.id !== taskId),
          };
        });
      }
    },
    [noteId, unlinkTaskFromNote, setNote, content, title]
  );

  // Handle opening task details dialog
  const handleOpenTaskDetails = useCallback(
    (task: Task) => {
      // Convert Task to TaskWithProject for the dialog
      const taskWithProject: TaskWithProject = {
        ...task,
        project: project || null,
      };
      setSelectedTask(taskWithProject);
      setShowTaskDetails(true);
    },
    [project]
  );

  // Handle task update from details dialog
  const handleTaskDetailsUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!selectedTask) return;

      const result = await updateTask(selectedTask.id, data);
      if (result) {
        // Optimistically update the task in local state, preserving current content/title
        setNote((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content,
            title: title,
            tasks: prev.tasks.map((t) =>
              t.id === selectedTask.id ? { ...t, ...data } : t
            ),
          };
        });
        // Also update selectedTask so dialog reflects changes
        setSelectedTask((prev) =>
          prev ? { ...prev, ...data } : prev
        );
      }
    },
    [selectedTask, updateTask, setNote, content, title]
  );

  // Handle task delete confirmation
  const handleDeleteTaskConfirm = useCallback(async () => {
    if (!deleteTaskConfirm) return;
    const success = await deleteTask(deleteTaskConfirm);
    if (success) {
      // Remove task from local state, preserving current content/title
      setNote((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content: content,
          title: title,
          tasks: prev.tasks.filter((t) => t.id !== deleteTaskConfirm),
        };
      });
    }
    setDeleteTaskConfirm(null);
  }, [deleteTaskConfirm, deleteTask, setNote, content, title]);

  // Handle delete note
  const handleDelete = useCallback(async () => {
    const success = await deleteNote(noteId);
    if (success) {
      router.push(`/projects/${projectId}`);
    }
  }, [noteId, projectId, deleteNote, router]);

  // Handle AI task extraction
  const handleExtractTasks = useCallback(() => {
    setShowExtractionDialog(true);
    taskExtraction.extractFromNote(noteId, content, projectId, project?.title);
  }, [noteId, content, projectId, project?.title, taskExtraction]);

  if (projectLoading || noteLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
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
                <div className="border rounded-lg divide-y">
                  {note.tasks.map((task) => {
                    const priorityConfig = PRIORITY_DISPLAY_SHORT[task.priority];
                    const isCompleted = task.status === "done";

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/30 group"
                      >
                        {/* Status toggle */}
                        <button
                          type="button"
                          onClick={() => handleTaskStatusToggle(task)}
                          className={cn(
                            "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isCompleted
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/50 hover:border-primary"
                          )}
                        >
                          {isCompleted && <Check className="h-3 w-3" />}
                        </button>

                        {/* Task info - clickable to open details */}
                        <button
                          type="button"
                          onClick={() => handleOpenTaskDetails(task)}
                          className="flex-1 min-w-0 text-left hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                        >
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isCompleted && "line-through text-muted-foreground"
                            )}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {task.description}
                            </p>
                          )}
                        </button>

                        {/* Priority badge */}
                        <span
                          className={cn(
                            "text-xs font-medium",
                            priorityConfig.color
                          )}
                        >
                          {priorityConfig.label}
                        </span>

                        {/* Unlink button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={() => handleUnlinkTask(task.id)}
                          title="Unlink task from note"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
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

      {/* Task Details Dialog */}
      {selectedTask && (
        <TaskDetailsResponsive
          task={selectedTask}
          profiles={profiles}
          projects={project ? [project] : []}
          open={showTaskDetails}
          onOpenChange={(open) => {
            setShowTaskDetails(open);
            if (!open) {
              setSelectedTask(null);
            }
          }}
          onUpdate={handleTaskDetailsUpdate}
          onDelete={(taskId) => {
            setShowTaskDetails(false);
            setSelectedTask(null);
            setDeleteTaskConfirm(taskId);
          }}
        />
      )}

      {/* Delete Task Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteTaskConfirm}
        onOpenChange={(open) => !open && setDeleteTaskConfirm(null)}
        onConfirm={handleDeleteTaskConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
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
