"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  ExternalLink,
  FileText,
  StickyNote,
  Link as LinkIcon,
  Hash,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRight,
  Settings2,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { TaskDialog, TaskDetailsResponsive, TaskListItem } from "@/components/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MarkdownEditor, MarkdownRenderer } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProject, useProjectMutations } from "@/hooks/use-projects";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useProjectDocuments, useDocumentMutations } from "@/hooks/use-documents";
import { useProjectMembers } from "@/hooks/use-project-members";
import { useProjectNotes } from "@/hooks/use-notes";
import { InviteMemberDialog, PropertiesPanel } from "@/components/project";
import { NoteListItem } from "@/components/note";
import type { DocumentType, Project, ProjectStatus, TaskPriority, TaskWithProject, Task, TaskStatus } from "@/types";
import type { CreateTaskInput, UpdateTaskInput, CreateDocumentInput } from "@/lib/validation";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { project, setProject, loading, refetch } = useProject(projectId);
  const { documents, refetch: refetchDocuments } = useProjectDocuments(projectId);
  const { profiles } = useProfiles();
  const { updateProject, deleteProject, loading: projectMutationLoading } =
    useProjectMutations();
  const { createTask, updateTask, deleteTask, loading: taskMutationLoading } = useTaskMutations();
  const { createDocument, deleteDocument, loading: documentMutationLoading } =
    useDocumentMutations();
  const { members } = useProjectMembers(projectId);
  const { notes } = useProjectNotes(projectId);

  // Inline editing state - use project values directly as initial values
  // Use projectId as key to reset state when navigating between projects
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [showResources, setShowResources] = useState(documents.length > 0);
  const [showTasks, setShowTasks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Track previous project ID to reset editing state when project changes
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setTitle(project?.title ?? "");
    setDescription(project?.description ?? "");
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }

  // Track if project data has loaded and update local state
  const [hasInitializedFromProject, setHasInitializedFromProject] = useState(false);
  if (project && !hasInitializedFromProject) {
    setHasInitializedFromProject(true);
    setTitle(project.title);
    setDescription(project.description ?? "");
    if (documents.length > 0) {
      setShowResources(true);
    }
  }

  // Dialog state
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<string | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);

  // Properties panel state
  const [showProperties, setShowProperties] = useState(true);
  const [showMobileProperties, setShowMobileProperties] = useState(false);

  // Document form state
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState<DocumentType>("link");

  // Reset document form
  const resetDocForm = () => {
    setDocTitle("");
    setDocUrl("");
    setDocContent("");
    setDocType("link");
  };

  // Handle title save
  const handleTitleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle && trimmedTitle !== project?.title) {
      await updateProject(projectId, { title: trimmedTitle });
      // Don't call refetch() - local state (title) is already correct, avoids UI glitch
    } else {
      // Reset to project title if unchanged or invalid
      setTitle(project?.title ?? "");
    }
    setIsEditingTitle(false);
  }, [title, project?.title, projectId, updateProject]);

  // Handle description save
  const handleDescriptionSave = useCallback(async () => {
    const newDescription = description.trim() || null;
    if (newDescription !== (project?.description || null)) {
      await updateProject(projectId, { description: newDescription });
      // Don't call refetch() - local state (description) is already correct, avoids UI glitch
    } else {
      // Reset to project description if unchanged
      setDescription(project?.description ?? "");
    }
    setIsEditingDescription(false);
  }, [description, project?.description, projectId, updateProject]);

  // Handle status change
  const handleStatusChange = useCallback(async (status: string) => {
    const result = await updateProject(projectId, { status: status as ProjectStatus });
    if (result) {
      setProject((prev) => prev ? { ...prev, status: status as ProjectStatus } : null);
    }
  }, [projectId, updateProject, setProject]);

  // Handle color change
  const handleColorChange = useCallback(async (color: string) => {
    const result = await updateProject(projectId, { color });
    if (result) {
      setProject((prev) => prev ? { ...prev, color } : null);
    }
  }, [projectId, updateProject, setProject]);

  // Handle lead change
  const handleLeadChange = useCallback(async (leadId: string | null) => {
    const result = await updateProject(projectId, { lead_id: leadId });
    if (result) {
      setProject((prev) => prev ? { ...prev, lead_id: leadId } : null);
    }
  }, [projectId, updateProject, setProject]);

  // Handle due date change
  const handleDueDateChange = useCallback(async (date: Date | null) => {
    const dueDate = date ? date.toISOString() : null;
    const result = await updateProject(projectId, { due_date: dueDate });
    if (result) {
      setProject((prev) => prev ? { ...prev, due_date: dueDate } : null);
    }
  }, [projectId, updateProject, setProject]);

  // Handle priority change
  const handlePriorityChange = useCallback(async (priority: string) => {
    const result = await updateProject(projectId, { priority: priority as TaskPriority });
    if (result) {
      setProject((prev) => prev ? { ...prev, priority: priority as TaskPriority } : null);
    }
  }, [projectId, updateProject, setProject]);

  // Handle project delete
  const handleDeleteProject = useCallback(async () => {
    await deleteProject(projectId);
    router.push("/projects");
  }, [projectId, deleteProject, router]);

  // Handle task creation
  const handleCreateTask = useCallback(
    async (data: CreateTaskInput | UpdateTaskInput) => {
      await createTask(data as CreateTaskInput);
      refetch();
    },
    [createTask, refetch]
  );

  // Handle opening task details
  const handleOpenTaskDetails = useCallback((task: Task) => {
    // Convert Task to TaskWithProject
    const taskWithProject: TaskWithProject = {
      ...task,
      project: project || null,
    };
    setSelectedTask(taskWithProject);
    setShowTaskDetails(true);
  }, [project]);

  // Handle task update from details dialog
  const handleTaskDetailsUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!selectedTask || !project) return;
      const result = await updateTask(selectedTask.id, data);
      if (result) {
        // Update selectedTask so the dialog shows correct values
        const updatedTask = { ...selectedTask, ...data } as TaskWithProject;
        setSelectedTask(updatedTask);

        // Optimistically update the project's tasks list (no refetch needed)
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === selectedTask.id ? { ...t, ...data } : t
            ),
          };
        });
      }
    },
    [selectedTask, project, updateTask, setProject]
  );

  // Handle task delete confirmation
  const handleDeleteTaskConfirm = useCallback(async () => {
    if (!deleteTaskConfirm) return;
    const success = await deleteTask(deleteTaskConfirm);
    if (success) {
      // Optimistically remove from project's tasks list
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== deleteTaskConfirm),
        };
      });
    }
    setDeleteTaskConfirm(null);
  }, [deleteTaskConfirm, deleteTask, setProject]);

  // Handle task status toggle (for list view)
  const handleTaskStatusToggle = useCallback(
    async (task: Task) => {
      const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      const result = await updateTask(task.id, { status: newStatus });
      if (result) {
        // Optimistically update the project's tasks list
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? { ...t, status: newStatus } : t
            ),
          };
        });
      }
    },
    [updateTask, setProject]
  );

  // Handle document creation
  const handleCreateDocument = useCallback(async () => {
    if (!docTitle.trim()) return;

    const data: CreateDocumentInput = {
      project_id: projectId,
      title: docTitle.trim(),
      type: docType,
      url: docType === "link" ? docUrl.trim() || null : null,
      content: docType === "note" ? docContent.trim() || null : null,
    };

    await createDocument(data);
    refetchDocuments();
    setShowDocumentDialog(false);
    resetDocForm();
  }, [projectId, docTitle, docType, docUrl, docContent, createDocument, refetchDocuments]);

  // Handle document delete
  const handleDeleteDocument = useCallback(async () => {
    if (!deleteDocumentId) return;
    await deleteDocument(deleteDocumentId);
    refetchDocuments();
    setDeleteDocumentId(null);
  }, [deleteDocumentId, deleteDocument, refetchDocuments]);

  // Handle keyboard shortcuts for editing
  const handleKeyDown = (
    e: React.KeyboardEvent,
    onSave: () => void,
    onCancel: () => void
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="p-4 md:p-6 text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-full flex flex-col">
        {/* Top navigation bar */}
        <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Projects
              </Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium truncate max-w-[200px]">
              {project.title}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteProjectConfirm(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Main content - two column layout */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left panel - Main content */}
            <div className="flex-1 px-4 md:px-8 lg:px-16 py-8 overflow-y-auto md:border-r border-border/40">
              {/* Project icon and title */}
              <div className="flex items-start gap-3 mb-6">
                <div
                  className="mt-1 p-2 rounded-lg"
                  style={{ backgroundColor: project.color + "20" }}
                >
                  <Hash className="h-6 w-6" style={{ color: project.color }} />
                </div>

                <div className="flex-1">
                  {isEditingTitle ? (
                    <div className="space-y-2">
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) =>
                          handleKeyDown(
                            e,
                            handleTitleSave,
                            () => {
                              setTitle(project.title);
                              setIsEditingTitle(false);
                            }
                          )
                        }
                        autoFocus
                        className="!text-2xl font-bold border-0 p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleTitleSave}
                          disabled={!title.trim() || projectMutationLoading}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTitle(project.title);
                            setIsEditingTitle(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-left text-2xl font-bold hover:text-muted-foreground transition-colors"
                    >
                      {title || project.title}
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <MarkdownEditor
                      value={description}
                      onChange={setDescription}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setDescription(project.description || "");
                          setIsEditingDescription(false);
                        }
                      }}
                      autoFocus
                      rows={4}
                      placeholder="Add a description..."
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleDescriptionSave}
                        disabled={projectMutationLoading}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDescription(project.description || "");
                          setIsEditingDescription(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="text-left w-full min-h-[40px] text-muted-foreground hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
                  >
                    {(description || project.description) ? (
                      <MarkdownRenderer
                        content={description || project.description}
                        className="text-foreground"
                      />
                    ) : (
                      <p>Add a description...</p>
                    )}
                  </button>
                )}
              </div>

              {/* Tasks Section - Collapsible */}
              <div className="border-t border-border/40 pt-6 mb-6">
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
                    Tasks
                    {project.tasks.length > 0 && (
                      <span className="text-xs font-normal">({project.tasks.length})</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    {project.tasks.length > 0 && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/projects/${projectId}/tasks`}>
                          View All
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTaskDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Task
                    </Button>
                  </div>
                </div>

                {showTasks && (
                  <>
                    {project.tasks.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {project.tasks.slice(0, 10).map((task) => (
                          <TaskListItem
                            key={task.id}
                            task={task}
                            onTaskClick={handleOpenTaskDetails}
                            onStatusToggle={handleTaskStatusToggle}
                            assignee={profiles.find((p) => p.id === task.assignee_id) || null}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                        <p className="mb-1">No tasks yet</p>
                        <p className="text-xs">Add tasks to track work for this project</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Notes Section - Collapsible */}
              <div className="border-t border-border/40 pt-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    {showNotes ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Notes
                    {notes.length > 0 && (
                      <span className="text-xs font-normal">({notes.length})</span>
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/projects/${projectId}/notes/create`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Note
                  </Button>
                </div>

                {showNotes && (
                  <>
                    {notes.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {notes.slice(0, 5).map((note) => (
                          <NoteListItem
                            key={note.id}
                            note={note}
                            onClick={() => router.push(`/projects/${projectId}/notes/${note.id}`)}
                          />
                        ))}
                        {notes.length > 5 && (
                          <div className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/projects/${projectId}/notes`)}
                            >
                              View all {notes.length} notes
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="mb-1">No notes yet</p>
                        <p className="text-xs">Take notes during meetings and create tasks from them</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resources Section - Collapsible */}
              <div className="border-t border-border/40 pt-6">
                <button
                  onClick={() => setShowResources(!showResources)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full mb-4"
                >
                  {showResources ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Resources
                  {documents.length > 0 && (
                    <span className="text-xs font-normal">({documents.length})</span>
                  )}
                </button>

                {showResources && (
                  <div className="space-y-2">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 group"
                        >
                          {doc.type === "link" ? (
                            <LinkIcon className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : doc.type === "note" ? (
                            <StickyNote className="h-4 w-4 text-amber-500 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            {doc.type === "link" && doc.url && (
                              <p className="text-xs text-muted-foreground truncate">{doc.url}</p>
                            )}
                            {doc.type === "note" && doc.content && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{doc.content}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {doc.type === "link" && doc.url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteDocumentId(doc.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No resources yet</p>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground mt-2"
                      onClick={() => setShowDocumentDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add document or link...
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel - Properties sidebar (desktop/tablet, collapsible) */}
            {showProperties && (
              <div className="hidden md:block w-[280px] p-5 bg-muted/20 overflow-y-auto transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Properties
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => setShowProperties(false)}
                    title="Hide properties"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </Button>
                </div>

                <PropertiesPanel
                  project={project}
                  profiles={profiles}
                  membersCount={members.length}
                  projectMutationLoading={projectMutationLoading}
                  onStatusChange={handleStatusChange}
                  onLeadChange={handleLeadChange}
                  onDueDateChange={handleDueDateChange}
                  onPriorityChange={handlePriorityChange}
                  onColorChange={handleColorChange}
                  onShowMembers={() => setShowMembersDialog(true)}
                />
              </div>
            )}

            {/* Collapsed properties toggle button (desktop/tablet) */}
            {!showProperties && (
              <div className="hidden md:flex items-start p-2 bg-muted/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setShowProperties(true)}
                  title="Show properties"
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile properties floating button */}
      <button
        onClick={() => setShowMobileProperties(true)}
        className="fixed bottom-28 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lg ring-1 ring-border/50 transition-transform hover:scale-105 active:scale-95 md:hidden"
        aria-label="Open properties"
      >
        <Settings2 className="h-5 w-5" />
      </button>

      {/* Mobile properties sheet */}
      <Sheet open={showMobileProperties} onOpenChange={setShowMobileProperties}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>Properties</SheetTitle>
          </SheetHeader>
          <PropertiesPanel
            project={project}
            profiles={profiles}
            membersCount={members.length}
            projectMutationLoading={projectMutationLoading}
            onStatusChange={handleStatusChange}
            onLeadChange={handleLeadChange}
            onDueDateChange={handleDueDateChange}
            onPriorityChange={handlePriorityChange}
            onColorChange={handleColorChange}
            onShowMembers={() => setShowMembersDialog(true)}
          />
        </SheetContent>
      </Sheet>

      {/* Task create dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        projects={[project as Project]}
        profiles={profiles}
        defaultStatus="todo"
        onSubmit={handleCreateTask}
        loading={taskMutationLoading}
      />

      {/* Task details dialog */}
      <TaskDetailsResponsive
        open={showTaskDetails}
        onOpenChange={(open) => {
          setShowTaskDetails(open);
          if (!open) setSelectedTask(null);
        }}
        task={selectedTask}
        profiles={profiles}
        projects={[project as Project]}
        onUpdate={handleTaskDetailsUpdate}
        onDelete={(taskId) => {
          setShowTaskDetails(false);
          setDeleteTaskConfirm(taskId);
        }}
      />

      {/* Document create dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type">Type</Label>
              <Select
                value={docType}
                onValueChange={(value) => setDocType(value as DocumentType)}
              >
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-title">Title *</Label>
              <Input
                id="doc-title"
                placeholder="Enter title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            {docType === "link" && (
              <div className="space-y-2">
                <Label htmlFor="doc-url">URL *</Label>
                <Input
                  id="doc-url"
                  type="url"
                  placeholder="https://example.com"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  maxLength={2000}
                />
              </div>
            )}

            {docType === "note" && (
              <div className="space-y-2">
                <Label htmlFor="doc-content">Content *</Label>
                <Textarea
                  id="doc-content"
                  placeholder="Write your note..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={4}
                  maxLength={10000}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDocumentDialog(false);
                  resetDocForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDocument}
                disabled={
                  documentMutationLoading ||
                  !docTitle.trim() ||
                  (docType === "link" && !docUrl.trim()) ||
                  (docType === "note" && !docContent.trim())
                }
              >
                {documentMutationLoading ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete project confirmation */}
      <DeleteConfirmationDialog
        open={deleteProjectConfirm}
        onOpenChange={setDeleteProjectConfirm}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.title}"? This will also delete all its tasks and documents. This action cannot be undone.`}
      />

      {/* Delete document confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteDocumentId}
        onOpenChange={(open) => !open && setDeleteDocumentId(null)}
        onConfirm={handleDeleteDocument}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      />

      {/* Delete task confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteTaskConfirm}
        onOpenChange={(open) => !open && setDeleteTaskConfirm(null)}
        onConfirm={handleDeleteTaskConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />

      {/* Invite member dialog */}
      <InviteMemberDialog
        open={showMembersDialog}
        onOpenChange={setShowMembersDialog}
        projectId={projectId}
        projectCreatorId={project.created_by}
      />
    </AppShell>
  );
}
