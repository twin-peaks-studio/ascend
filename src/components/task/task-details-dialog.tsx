"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
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
import { MarkdownEditor, MarkdownRenderer } from "@/components/shared";
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
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/file-upload";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { useAttachments } from "@/hooks/use-attachments";
import type { TaskWithProject, Profile, TaskStatus, TaskPriority, Project } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";

// Todoist-style priority mapping
const PRIORITY_DISPLAY: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: "P1", color: "text-red-500" },
  high: { label: "P2", color: "text-orange-500" },
  medium: { label: "P3", color: "text-blue-500" },
  low: { label: "P4", color: "text-muted-foreground" },
};

const STATUS_DISPLAY: Record<TaskStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

interface TaskDetailsDialogProps {
  task: TaskWithProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: UpdateTaskInput) => Promise<void>;
  profiles: Profile[];
  projects: Project[];
  loading?: boolean;
}

/**
 * Get initials from profile for avatar
 */
function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}

/**
 * Format due date in Todoist style
 */
function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Track task ID to reset state when task changes (render-time state sync)
  const [prevTaskId, setPrevTaskId] = useState<string | null>(task?.id ?? null);
  if (task && prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setShowAttachments(false);
  }

  // Attachments
  const {
    attachments,
    uploading,
    uploadFile,
    deleteAttachment,
    downloadFile,
  } = useAttachments("task", task?.id || null);

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

  if (!task) return null;

  const priorityConfig = PRIORITY_DISPLAY[task.priority];
  const isCompleted = task.status === "done";
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

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

  const handleDueDateChange = async (date: Date | undefined) => {
    await onUpdate({ due_date: date?.toISOString() || null });
    setDatePickerOpen(false);
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    await onUpdate({ assignee_id: assigneeId === "__none__" ? null : assigneeId });
  };

  const handlePriorityChange = async (priority: string) => {
    await onUpdate({ priority: priority as TaskPriority });
  };

  const handleStatusChange = async (status: string) => {
    await onUpdate({ status: status as TaskStatus });
  };

  const handleProjectChange = async (projectId: string) => {
    await onUpdate({ project_id: projectId === "__none__" ? null : projectId });
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

  const assignee = profiles.find((p) => p.id === task.assignee_id);

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
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDescription(task.description || "");
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
          </div>

          {/* Sidebar - Right Panel */}
          <div className="p-4 bg-muted/20 overflow-y-auto">
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
                  {profiles.map((profile) => (
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
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 hover:bg-muted/50 -mx-1.5 px-1.5 py-0.5 rounded w-full text-left text-xs",
                      isOverdue && "text-red-500"
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
                    selected={task.due_date ? new Date(task.due_date) : undefined}
                    onSelect={handleDueDateChange}
                    initialFocus
                  />
                  {task.due_date && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDueDateChange(undefined)}
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
            <SidebarRow label="Status" className="border-b-0">
              <Select
                value={task.status}
                onValueChange={handleStatusChange}
                disabled={loading}
              >
                <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-1.5 px-1.5 rounded min-h-0 text-xs">
                  <SelectValue>
                    <span>{STATUS_DISPLAY[task.status]}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo" className="text-xs">To Do</SelectItem>
                  <SelectItem value="in-progress" className="text-xs">In Progress</SelectItem>
                  <SelectItem value="done" className="text-xs">Done</SelectItem>
                </SelectContent>
              </Select>
            </SidebarRow>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
