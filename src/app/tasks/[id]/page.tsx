"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Circle,
  CheckCircle2,
  Calendar,
  Flag,
  Hash,
  User,
  Paperclip,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
  PanelRightClose,
  PanelRight,
  Settings2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextEditor, PresenceAvatars } from "@/components/shared";
import { MarkdownRenderer } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { FileUpload } from "@/components/shared/file-upload";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { TimerButton, TimeEntryList } from "@/components/time";
import { CommentList } from "@/components/comments/comment-list";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTask } from "@/hooks/use-task";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useProjects } from "@/hooks/use-projects";
import { useAttachments } from "@/hooks/use-attachments";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import { useProjectAssignees } from "@/hooks/use-project-assignees";
import { cn } from "@/lib/utils";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import type { TaskStatus, TaskPriority } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";

/**
 * Sidebar row component for consistent styling
 */
function SidebarRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-2 border-b border-border/40", className)}>
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
      <div className="text-xs">{children}</div>
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = params.id as string;
  const cameFromTasks = searchParams.get("from") === "tasks";

  // Fetch task data
  const { task, isLoading, error } = useTask(taskId);
  const { profiles } = useProfiles();
  const { projects } = useProjects();
  const { updateTask, deleteTask } = useTaskMutations();

  // Get assignable profiles based on task's project
  const { assignableProfiles } = useProjectAssignees(
    task?.project_id || null,
    profiles
  );

  // Attachments
  const {
    attachments,
    uploading,
    uploadFile,
    deleteAttachment,
    downloadFile,
  } = useAttachments("task", taskId);

  // Time tracking
  const { entries: timeEntries, formattedTotalTime, totalTime } = useTimeTracking(
    "task",
    taskId
  );

  // Local editing state
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [mobileDateExpanded, setMobileDateExpanded] = useState(false);
  const [pendingDueDate, setPendingDueDate] = useState<Date | null>(
    task?.due_date ? new Date(task.due_date) : null
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Properties panel state
  const [showProperties, setShowProperties] = useState(true);
  const [showMobileProperties, setShowMobileProperties] = useState(false);

  // Track task ID to sync local state only when task changes (not on every render)
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  if (task && prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPendingDueDate(task.due_date ? new Date(task.due_date) : null);
  }

  // Sync pending date when task.due_date changes from an external update
  const [prevDueDate, setPrevDueDate] = useState<string | null>(task?.due_date ?? null);
  if (task && task.due_date !== prevDueDate) {
    setPrevDueDate(task.due_date);
    if (!datePickerOpen) {
      setPendingDueDate(task.due_date ? new Date(task.due_date) : null);
    }
  }

  // Auto-expand attachments when they exist
  const hasAttachments = attachments.length > 0;
  if (hasAttachments && !showAttachments) {
    setShowAttachments(true);
  }

  const handleBack = useCallback(() => {
    // Smart back navigation
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tasks");
    }
  }, [router]);

  const handleUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!task) return;
      setLoading(true);
      // Pass previous assignee for notification tracking when assignee changes
      const previousAssigneeId = "assignee_id" in data ? task.assignee_id : undefined;
      const result = await updateTask(task.id, data, previousAssigneeId);
      setLoading(false);
      if (!result) {
        // Revert optimistic updates on failure
        setTitle(task.title);
        setDescription(task.description ?? "");
      }
    },
    [task, updateTask]
  );

  const handleTitleSave = useCallback(async () => {
    if (title.trim() && title !== task?.title) {
      await handleUpdate({ title: title.trim() });
    }
    setIsEditingTitle(false);
  }, [title, task, handleUpdate]);

  const handleDescriptionSave = useCallback(async () => {
    const newDescription = description.trim() || null;
    if (newDescription !== task?.description) {
      await handleUpdate({ description: newDescription });
    }
    setIsEditingDescription(false);
  }, [description, task, handleUpdate]);

  const handleStatusChange = useCallback(
    async (status: string) => {
      await handleUpdate({ status: status as TaskStatus });
    },
    [handleUpdate]
  );

  const handlePriorityChange = useCallback(
    async (priority: string) => {
      await handleUpdate({ priority: priority as TaskPriority });
    },
    [handleUpdate]
  );

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      const newProjectId = projectId === "__none__" ? null : projectId;
      await handleUpdate({ project_id: newProjectId });
    },
    [handleUpdate]
  );

  const handleAssigneeChange = useCallback(
    async (assigneeId: string) => {
      const newAssigneeId = assigneeId === "__none__" ? null : assigneeId;
      await handleUpdate({ assignee_id: newAssigneeId });
    },
    [handleUpdate]
  );

  const handleDueDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) {
        setPendingDueDate(null);
        return;
      }
      // Preserve time from pending date
      if (pendingDueDate) {
        date.setHours(pendingDueDate.getHours(), pendingDueDate.getMinutes(), 0, 0);
      }
      setPendingDueDate(date);
    },
    [pendingDueDate]
  );

  const handleDueTimeChange = useCallback((date: Date) => {
    setPendingDueDate(date);
  }, []);

  const handleDatePickerOpenChange = useCallback(
    async (open: boolean) => {
      if (!open && datePickerOpen && task) {
        // Popover is closing — save the pending value
        const newValue = pendingDueDate?.toISOString() || null;
        if (newValue !== (task.due_date || null)) {
          await handleUpdate({ due_date: newValue });
        }
      }
      setDatePickerOpen(open);
    },
    [datePickerOpen, pendingDueDate, task, handleUpdate]
  );

  const handleClearDueDate = useCallback(async () => {
    setPendingDueDate(null);
    await handleUpdate({ due_date: null });
    setDatePickerOpen(false);
    setMobileDateExpanded(false);
  }, [handleUpdate]);

  const handleMobileDateToggle = useCallback(async () => {
    if (mobileDateExpanded && task) {
      // Collapsing — save the pending value
      const newValue = pendingDueDate?.toISOString() || null;
      if (newValue !== (task.due_date || null)) {
        await handleUpdate({ due_date: newValue });
      }
    }
    setMobileDateExpanded((prev) => !prev);
  }, [mobileDateExpanded, pendingDueDate, task, handleUpdate]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    setIsDeleting(true);
    // Navigate back to where the user came from:
    // - From /tasks page (has ?from=tasks) → /tasks
    // - From a project context → /projects/[id]/tasks
    // - Independent task (no project) → /tasks
    const destination = cameFromTasks || !task.project_id
      ? "/tasks"
      : `/projects/${task.project_id}/tasks`;
    const success = await deleteTask(task.id);
    if (success) {
      router.push(destination);
    } else {
      setIsDeleting(false);
    }
    setDeleteConfirm(false);
  }, [task, deleteTask, router, cameFromTasks]);

  const handleKeyDown = useCallback(
    (
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
    },
    []
  );

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  // Error states
  if (error) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Failed to load task. Please try again.
            </p>
            <Button onClick={handleBack}>Go Back</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!task) {
    // Show spinner while deleting so the user doesn't see "Task not found"
    if (isDeleting) {
      return (
        <AppShell>
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Task not found</p>
            <Button onClick={handleBack}>Go Back</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const isCompleted = task.status === "done";
  const isTaskOverdue = task.due_date && isOverdue(task.due_date);
  const priorityConfig = PRIORITY_DISPLAY_SHORT[task.priority];
  const assignee = assignableProfiles.find((p) => p.id === task.assignee_id) ||
    profiles.find((p) => p.id === task.assignee_id);

  return (
    <AppShell>
      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 px-4 md:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="text-sm text-muted-foreground">
              <Link href="/tasks" className="hover:text-foreground">
                Tasks
              </Link>
              {task.project && (
                <>
                  {" / "}
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="hover:text-foreground"
                  >
                    {task.project.title}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PresenceAvatars entityType="task" entityId={taskId} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
        {/* Left Panel - Main Content */}
        <div className="flex-1 px-4 md:px-16 py-10 overflow-y-auto md:border-r border-border/40">
          {/* Title with checkbox */}
          <div className="flex items-start gap-3 mb-6">
            <button
              onClick={() => handleStatusChange(isCompleted ? "todo" : "done")}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <Circle className="h-6 w-6" />
              )}
            </button>

            {isEditingTitle ? (
              <div className="flex-1 space-y-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, handleTitleSave, () => {
                      setTitle(task.title);
                      setIsEditingTitle(false);
                    })
                  }
                  autoFocus
                  className="!text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleTitleSave}
                    disabled={!title.trim() || loading}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTitle(task.title);
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
                className={cn(
                  "text-left flex-1 text-2xl font-semibold hover:text-muted-foreground transition-colors",
                  isCompleted && "line-through text-muted-foreground"
                )}
              >
                {title || task.title}
              </button>
            )}
          </div>

          {/* Description */}
          <div className="mb-8">
            {isEditingDescription ? (
              <div className="space-y-2">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDescription(task.description || "");
                      setIsEditingDescription(false);
                    }
                  }}
                  autoFocus
                  minHeight={120}
                  placeholder="Add a description..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleDescriptionSave}
                    disabled={loading}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDescription(task.description || "");
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
                className="text-left w-full min-h-[80px] text-sm hover:bg-muted/30 rounded-md p-3 -mx-3 transition-colors"
              >
                {description || task.description ? (
                  <MarkdownRenderer
                    content={description || task.description}
                  />
                ) : (
                  <p className="text-muted-foreground">Add a description...</p>
                )}
              </button>
            )}
          </div>

          {/* Due Date - inline on mobile only (desktop uses sidebar) */}
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMobileDateToggle}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  task.due_date && isTaskOverdue && !isCompleted
                    ? "text-red-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mobileDateExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Calendar className="h-4 w-4" />
                {task.due_date ? (
                  <span>{formatDueDate(task.due_date)}</span>
                ) : (
                  <span>Due Date</span>
                )}
              </button>
              {task.due_date && (
                <button
                  onClick={handleClearDueDate}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {mobileDateExpanded && (
              <div className="mt-3 rounded-lg border bg-popover w-fit max-w-full">
                <CalendarComponent
                  mode="single"
                  selected={pendingDueDate || undefined}
                  onSelect={handleDueDateSelect}
                  calendarFooter={
                    <>
                      <div className="border-t" />
                      <TimePicker value={pendingDueDate} onChange={handleDueTimeChange} />
                      {pendingDueDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={handleClearDueDate}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </>
                  }
                />
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="flex items-center gap-2 text-sm font-medium mb-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAttachments ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Paperclip className="h-4 w-4" />
              <span>
                Attachments {attachments.length > 0 && `(${attachments.length})`}
              </span>
            </button>

            {showAttachments && (
              <div className="space-y-4">
                <FileUpload onUpload={uploadFile} uploading={uploading} />
                <AttachmentsList
                  attachments={attachments}
                  onDownload={downloadFile}
                  onDelete={deleteAttachment}
                />
              </div>
            )}
          </div>

          {/* Time Tracking */}
          <div className="mb-8">
            <button
              onClick={() => setShowTimeEntries(!showTimeEntries)}
              className="flex items-center gap-2 text-sm font-medium mb-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showTimeEntries ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Clock className="h-4 w-4" />
              <span>Time Tracked</span>
              {totalTime > 0 && (
                <span className="ml-2 font-mono tabular-nums text-foreground text-xs">
                  {formattedTotalTime}
                </span>
              )}
              {timeEntries.filter((e) => e.end_time).length > 0 && (
                <span className="text-xs">
                  ({timeEntries.filter((e) => e.end_time).length})
                </span>
              )}
            </button>

            {showTimeEntries && (
              <TimeEntryList
                entityType="task"
                entityId={task.id}
                hideHeader
              />
            )}
          </div>

          {/* Comments - Always expanded, part of page scroll */}
          <div className="mb-8">
            <CommentList taskId={task.id} mentionProjectId={task.project_id} collapsible={false} />
          </div>
        </div>

        {/* Right Panel - Properties Sidebar (desktop, collapsible) */}
        {showProperties && (
        <div className="hidden md:block w-[300px] p-6 bg-muted/10 overflow-y-auto">
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

          {/* Project */}
          <SidebarRow label="Project">
            <Select
              value={task.project_id || "__none__"}
              onValueChange={handleProjectChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  {task.project ? (
                    <div className="flex items-start gap-1.5">
                      <Hash
                        className="h-3 w-3 shrink-0 mt-0.5"
                        style={{ color: task.project.color }}
                      />
                      <span className="text-left break-words">
                        {task.project.title}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span>No project</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span>No project</span>
                  </div>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Hash
                        className="h-3 w-3"
                        style={{ color: project.color }}
                      />
                      <span>{project.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Assignee */}
          <SidebarRow label="Assignee">
            <Select
              value={task.assignee_id || "__none__"}
              onValueChange={handleAssigneeChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  {assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-3.5 w-3.5">
                        <AvatarImage src={assignee.avatar_url || undefined} />
                        <AvatarFallback className="text-[7px]">
                          {getInitials(assignee.display_name, assignee.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="break-words">
                        {assignee.display_name || assignee.email}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Unassigned</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>Unassigned</span>
                  </div>
                </SelectItem>
                {assignableProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Avatar className="h-3.5 w-3.5">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[7px]">
                          {getInitials(profile.display_name, profile.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.display_name || profile.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Date */}
          <SidebarRow label="Due Date">
            <Popover open={datePickerOpen} onOpenChange={handleDatePickerOpenChange}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 hover:bg-muted/50 -mx-1.5 px-1.5 py-0.5 rounded w-full text-left text-xs",
                    isTaskOverdue && "text-red-500"
                  )}
                  disabled={loading}
                >
                  <Calendar className="h-3 w-3 shrink-0" />
                  {task.due_date ? (
                    <span>{formatDueDate(task.due_date)}</span>
                  ) : (
                    <span className="text-muted-foreground">Add date</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={pendingDueDate || undefined}
                  onSelect={handleDueDateSelect}
                  initialFocus
                  calendarFooter={
                    <>
                      <div className="border-t" />
                      <TimePicker value={pendingDueDate} onChange={handleDueTimeChange} />
                      {pendingDueDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={handleClearDueDate}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </>
                  }
                />
              </PopoverContent>
            </Popover>
          </SidebarRow>

          {/* Priority */}
          <SidebarRow label="Priority">
            <Select
              value={task.priority}
              onValueChange={handlePriorityChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  <div className={cn("flex items-center gap-1.5", priorityConfig.color)}>
                    <Flag className="h-3 w-3" />
                    <span>{priorityConfig.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <Flag className="h-3 w-3" />
                    <span>P1</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-1.5 text-xs text-orange-500">
                    <Flag className="h-3 w-3" />
                    <span>P2</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-1.5 text-xs text-blue-500">
                    <Flag className="h-3 w-3" />
                    <span>P3</span>
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Flag className="h-3 w-3" />
                    <span>P4</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Status */}
          <SidebarRow label="Status">
            <Select
              value={task.status}
              onValueChange={handleStatusChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  <span>{STATUS_CONFIG[task.status].label}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo" className="text-xs">
                  To Do
                </SelectItem>
                <SelectItem value="in-progress" className="text-xs">
                  In Progress
                </SelectItem>
                <SelectItem value="done" className="text-xs">
                  Done
                </SelectItem>
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Timer */}
          <SidebarRow label="Timer">
            <TimerButton
              entityType="task"
              entityId={task.id}
              entityName={task.title}
              size="sm"
              showLabel={true}
              className="w-full justify-center"
            />
          </SidebarRow>
        </div>
        )}

        {/* Collapsed properties toggle button (desktop) */}
        {!showProperties && (
          <div className="hidden md:flex items-start p-2 bg-muted/10">
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

          {/* Project */}
          <SidebarRow label="Project">
            <Select
              value={task.project_id || "__none__"}
              onValueChange={handleProjectChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  {task.project ? (
                    <div className="flex items-start gap-1.5">
                      <Hash
                        className="h-3 w-3 shrink-0 mt-0.5"
                        style={{ color: task.project.color }}
                      />
                      <span className="text-left break-words">
                        {task.project.title}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span>No project</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span>No project</span>
                  </div>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Hash
                        className="h-3 w-3"
                        style={{ color: project.color }}
                      />
                      <span>{project.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Assignee */}
          <SidebarRow label="Assignee">
            <Select
              value={task.assignee_id || "__none__"}
              onValueChange={handleAssigneeChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  {assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-3.5 w-3.5">
                        <AvatarImage src={assignee.avatar_url || undefined} />
                        <AvatarFallback className="text-[7px]">
                          {getInitials(assignee.display_name, assignee.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="break-words">
                        {assignee.display_name || assignee.email}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Unassigned</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>Unassigned</span>
                  </div>
                </SelectItem>
                {assignableProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Avatar className="h-3.5 w-3.5">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[7px]">
                          {getInitials(profile.display_name, profile.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.display_name || profile.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Due Date is handled inline on mobile (above attachments), not in this sheet */}

          {/* Priority */}
          <SidebarRow label="Priority">
            <Select
              value={task.priority}
              onValueChange={handlePriorityChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  <div className={cn("flex items-center gap-1.5", priorityConfig.color)}>
                    <Flag className="h-3 w-3" />
                    <span>{priorityConfig.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <Flag className="h-3 w-3" />
                    <span>P1</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-1.5 text-xs text-orange-500">
                    <Flag className="h-3 w-3" />
                    <span>P2</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-1.5 text-xs text-blue-500">
                    <Flag className="h-3 w-3" />
                    <span>P3</span>
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Flag className="h-3 w-3" />
                    <span>P4</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Status */}
          <SidebarRow label="Status">
            <Select
              value={task.status}
              onValueChange={handleStatusChange}
              disabled={loading}
            >
              <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                <SelectValue>
                  <span>{STATUS_CONFIG[task.status].label}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo" className="text-xs">
                  To Do
                </SelectItem>
                <SelectItem value="in-progress" className="text-xs">
                  In Progress
                </SelectItem>
                <SelectItem value="done" className="text-xs">
                  Done
                </SelectItem>
              </SelectContent>
            </Select>
          </SidebarRow>

          {/* Timer */}
          <SidebarRow label="Timer">
            <TimerButton
              entityType="task"
              entityId={task.id}
              entityName={task.title}
              size="sm"
              showLabel={true}
              className="w-full justify-center"
            />
          </SidebarRow>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
      />
      </div>
    </AppShell>
  );
}
