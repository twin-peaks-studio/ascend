"use client";

import { useState } from "react";
import {
  Circle,
  CheckCircle2,
  Calendar,
  Flag,
  Hash,
  User,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextEditor } from "@/components/shared";
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
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/file-upload";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { TimerButton, TimeEntryList } from "@/components/time";
import { CommentList } from "@/components/comments/comment-list";
import { useAttachments } from "@/hooks/use-attachments";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import { useProjectAssignees } from "@/hooks/use-project-assignees";
import type { TaskWithProject, Profile, TaskStatus, TaskPriority, Project } from "@/types";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";

interface TaskDetailsDialogProps {
  task: TaskWithProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: UpdateTaskInput) => Promise<void>;
  onDelete?: (taskId: string) => void;
  profiles: Profile[];
  projects: Project[];
  loading?: boolean;
}

/**
 * Sidebar row component for consistent styling (compact like Todoist)
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

export function TaskDetailsDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  profiles,
  projects,
  loading = false,
}: TaskDetailsDialogProps) {
  // Editable state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDueDate, setPendingDueDate] = useState<Date | null>(
    task?.due_date ? new Date(task.due_date) : null
  );

  // Track task ID to reset state when task changes (render-time state sync)
  const [prevTaskId, setPrevTaskId] = useState<string | null>(task?.id ?? null);
  if (task && prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setShowAttachments(false);
    setShowTimeEntries(false);
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

  // Attachments
  const {
    attachments,
    uploading,
    uploadFile,
    deleteAttachment,
    downloadFile,
  } = useAttachments("task", task?.id || null);

  // Time tracking
  const {
    entries: timeEntries,
    formattedTotalTime,
    totalTime,
  } = useTimeTracking("task", task?.id || "");

  // Auto-expand attachments section when attachments exist (render-time check)
  const [hasCheckedAttachments, setHasCheckedAttachments] = useState(false);
  if (attachments.length > 0 && !hasCheckedAttachments) {
    setHasCheckedAttachments(true);
    setShowAttachments(true);
  }
  // Reset the check when task changes
  if (task && prevTaskId === task.id && hasCheckedAttachments && attachments.length === 0) {
    setHasCheckedAttachments(false);
  }

  // Get assignable profiles based on task's project
  const { assignableProfiles, canAssign } = useProjectAssignees(task?.project_id || null, profiles);

  if (!task) return null;

  const priorityConfig = PRIORITY_DISPLAY_SHORT[task.priority];
  const isCompleted = task.status === "done";
  const isTaskOverdue = task.due_date && isOverdue(task.due_date);

  const handleTitleSave = async () => {
    if (title.trim() && title !== task.title) {
      await onUpdate({ title: title.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = async () => {
    const newDescription = description.trim() || null;
    if (newDescription !== task.description) {
      await onUpdate({ description: newDescription });
    }
    setIsEditingDescription(false);
  };

  const handleDueDateSelect = (date: Date | undefined) => {
    if (!date) {
      setPendingDueDate(null);
      return;
    }
    // Preserve time from pending date
    if (pendingDueDate) {
      date.setHours(pendingDueDate.getHours(), pendingDueDate.getMinutes(), 0, 0);
    }
    setPendingDueDate(date);
  };

  const handleDueTimeChange = (date: Date) => {
    setPendingDueDate(date);
  };

  const handleDatePickerOpenChange = async (open: boolean) => {
    if (!open && datePickerOpen) {
      // Popover is closing — save the pending value
      const newValue = pendingDueDate?.toISOString() || null;
      if (newValue !== (task.due_date || null)) {
        await onUpdate({ due_date: newValue });
      }
    }
    setDatePickerOpen(open);
  };

  const handleClearDueDate = async () => {
    setPendingDueDate(null);
    await onUpdate({ due_date: null });
    setDatePickerOpen(false);
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    const newAssigneeId = assigneeId === "__none__" ? null : assigneeId;
    // Only allow if the assignee is valid for this project
    if (newAssigneeId && !canAssign(newAssigneeId)) return;
    await onUpdate({ assignee_id: newAssigneeId });
  };

  const handlePriorityChange = async (priority: string) => {
    await onUpdate({ priority: priority as TaskPriority });
  };

  const handleStatusChange = async (status: string) => {
    await onUpdate({ status: status as TaskStatus });
  };

  const handleProjectChange = async (projectId: string) => {
    const newProjectId = projectId === "__none__" ? null : projectId;
    // When project changes, we need to check if current assignee is still valid
    // If not, we'll clear the assignee along with the project change
    const updates: UpdateTaskInput = { project_id: newProjectId };

    // Note: We'll let the parent component handle clearing the assignee
    // since this dialog doesn't have access to the new project's members immediately
    await onUpdate(updates);
  };

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

  const assignee = assignableProfiles.find((p) => p.id === task.assignee_id) ||
    profiles.find((p) => p.id === task.assignee_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] sm:max-w-[1100px] h-[75vh] max-h-[75vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] h-full">
          {/* Main Content - Left Panel */}
          <div className="px-16 py-10 overflow-y-auto md:border-r border-border/40">
            {/* Title with checkbox */}
            <div className="flex items-start gap-3 mb-6">
              <button
                onClick={() => handleStatusChange(isCompleted ? "todo" : "done")}
                className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>

              {isEditingTitle ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) =>
                      handleKeyDown(
                        e,
                        handleTitleSave,
                        () => {
                          setTitle(task.title);
                          setIsEditingTitle(false);
                        }
                      )
                    }
                    autoFocus
                    className="!text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
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
                    "text-left flex-1 text-xl font-semibold hover:text-muted-foreground transition-colors",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  {title || task.title}
                </button>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
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
                    minHeight={100}
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
                  className="text-left w-full min-h-[60px] text-sm hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
                >
                  {(description || task.description) ? (
                    <MarkdownRenderer content={description || task.description} />
                  ) : (
                    <p className="text-muted-foreground">Description</p>
                  )}
                </button>
              )}
            </div>

            {/* Attachments - Collapsible */}
            <div className="border-t border-border/40 pt-4">
              <button
                onClick={() => setShowAttachments(!showAttachments)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showAttachments ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Paperclip className="h-4 w-4" />
                <span>
                  Attachments{" "}
                  {attachments.length > 0 && `(${attachments.length})`}
                </span>
              </button>

              {showAttachments && (
                <div className="mt-4 space-y-4">
                  <FileUpload
                    onUpload={uploadFile}
                    uploading={uploading}
                  />
                  <AttachmentsList
                    attachments={attachments}
                    onDownload={downloadFile}
                    onDelete={deleteAttachment}
                  />
                </div>
              )}
            </div>

            {/* Time Tracking - Collapsible */}
            <div className="border-t border-border/40 pt-4">
              <button
                onClick={() => setShowTimeEntries(!showTimeEntries)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showTimeEntries ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Clock className="h-4 w-4" />
                <span>Time Tracked</span>
                {totalTime > 0 && (
                  <span className="ml-auto font-mono tabular-nums text-foreground text-xs">
                    {formattedTotalTime}
                  </span>
                )}
                {timeEntries.filter(e => e.end_time).length > 0 && (
                  <span className="text-xs">
                    ({timeEntries.filter(e => e.end_time).length})
                  </span>
                )}
              </button>

              {showTimeEntries && task && (
                <div className="mt-4">
                  <TimeEntryList
                    entityType="task"
                    entityId={task.id}
                    hideHeader
                  />
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-border/40 pt-4 mt-6">
              <CommentList taskId={task.id} mentionProjectId={task.project_id} />
            </div>
          </div>

          {/* Sidebar - Right Panel */}
          <div className="p-4 bg-muted/20 overflow-y-auto flex flex-col">
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
                        <span className="text-left break-words">{task.project.title}</span>
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
                        <span className="break-words">{assignee.display_name || assignee.email}</span>
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
            <SidebarRow label="Date">
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
                  />
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
                  <SelectItem value="todo" className="text-xs">To Do</SelectItem>
                  <SelectItem value="in-progress" className="text-xs">In Progress</SelectItem>
                  <SelectItem value="done" className="text-xs">Done</SelectItem>
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

            {/* Spacer to push delete and created by to bottom */}
            <div className="flex-1" />

            {/* Delete button */}
            {onDelete && (
              <div className="pt-4 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(task.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete task
                </Button>
              </div>
            )}

            {/* Created by info */}
            {task.created_at && (
              <div className="pt-4 mt-auto text-[10px] text-muted-foreground text-right">
                Created by {(() => {
                  const creator = profiles.find((p) => p.id === task.created_by);
                  return creator?.email || "Unknown";
                })()} on {new Date(task.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
