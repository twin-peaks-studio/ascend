"use client";

import { useState, useRef, forwardRef } from "react";
import {
  Circle,
  CheckCircle2,
  Calendar,
  Flag,
  User,
  Paperclip,
  X,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  AlignLeft,
  Trash2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/file-upload";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { TimerButton, TimeEntryList } from "@/components/time";
import { useAttachments } from "@/hooks/use-attachments";
import { useProjectAssignees } from "@/hooks/use-project-assignees";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import type { TaskWithProject, Profile, TaskPriority } from "@/types";
import { PRIORITY_DISPLAY_LONG } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate, isOverdue } from "@/lib/date-utils";

interface TaskEditMobileProps {
  task: TaskWithProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: UpdateTaskInput) => Promise<void>;
  onDelete?: (taskId: string) => void;
  profiles: Profile[];
  loading?: boolean;
}

/**
 * Property row component for populated fields - forwardRef for use with asChild
 */
const PropertyRow = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ElementType;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }
>(({ icon: Icon, children, onClick, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors",
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
    </button>
  );
});
PropertyRow.displayName = "PropertyRow";

/**
 * Chip button for empty/quick-add fields
 */
function PropertyChip({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  variant?: "default" | "highlight";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0",
        variant === "default" && "bg-muted/50 text-muted-foreground hover:bg-muted",
        variant === "highlight" && "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export function TaskEditMobile({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  profiles,
  loading = false,
}: TaskEditMobileProps) {
  // Editable state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [assigneeSelectOpen, setAssigneeSelectOpen] = useState(false);
  const [prioritySelectOpen, setPrioritySelectOpen] = useState(false);

  // Refs for focus management
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Track task ID to reset state when task changes
  const [prevTaskId, setPrevTaskId] = useState<string | null>(task?.id ?? null);
  if (task && prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setShowAttachments(false);
    setShowTimeEntries(false);
    setDatePickerOpen(false);
    setAssigneeSelectOpen(false);
    setPrioritySelectOpen(false);
  }

  // Attachments
  const {
    attachments,
    uploading,
    uploadFile,
    deleteAttachment,
    downloadFile,
  } = useAttachments("task", task?.id || null);

  // Auto-expand attachments when they exist
  const [hasCheckedAttachments, setHasCheckedAttachments] = useState(false);
  if (attachments.length > 0 && !hasCheckedAttachments) {
    setHasCheckedAttachments(true);
    setShowAttachments(true);
  }
  if (task && prevTaskId === task.id && hasCheckedAttachments && attachments.length === 0) {
    setHasCheckedAttachments(false);
  }

  // Get assignable profiles based on task's project
  const { assignableProfiles, canAssign } = useProjectAssignees(task?.project_id || null, profiles);

  // Time tracking
  const {
    entries: timeEntries,
    formattedTotalTime,
    totalTime,
  } = useTimeTracking("task", task?.id || "");

  if (!task) return null;

  const priorityConfig = PRIORITY_DISPLAY_LONG[task.priority];
  const isCompleted = task.status === "done";
  const isTaskOverdue = task.due_date && isOverdue(task.due_date);
  const assignee = assignableProfiles.find((p) => p.id === task.assignee_id) ||
    profiles.find((p) => p.id === task.assignee_id);

  // Determine which fields are empty (for chip display)
  const hasDescription = !!task.description;
  const hasDueDate = !!task.due_date;
  const hasAssignee = !!task.assignee_id;

  // Build list of empty property chips
  const emptyPropertyChips: { id: string; icon: React.ElementType; label: string; onClick: () => void; variant?: "default" | "highlight" }[] = [];

  // Note: Date and Assignee chips are handled separately with their own Popover wrappers
  // to ensure proper positioning of the dropdowns

  // Always show attachments chip if no attachments
  if (attachments.length === 0) {
    emptyPropertyChips.push({
      id: "attachments",
      icon: Paperclip,
      label: "Attachments",
      onClick: () => setShowAttachments(true),
    });
  }

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
    const newAssigneeId = assigneeId === "__none__" ? null : assigneeId;
    // Only allow if the assignee is valid for this project
    if (newAssigneeId && !canAssign(newAssigneeId)) return;
    await onUpdate({ assignee_id: newAssigneeId });
    setAssigneeSelectOpen(false);
  };

  const handlePriorityChange = async (priority: string) => {
    await onUpdate({ priority: priority as TaskPriority });
    setPrioritySelectOpen(false);
  };

  const handleToggleStatus = async () => {
    await onUpdate({ status: isCompleted ? "todo" : "done" });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Edit Task</DrawerTitle>
        </DrawerHeader>

        {/* Header with close and more actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDelete(task.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Title with checkbox */}
          <div className="flex items-start gap-3 py-4">
            <button
              type="button"
              onClick={handleToggleStatus}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
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
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleTitleSave();
                    } else if (e.key === "Escape") {
                      setTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none bg-transparent"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className={cn(
                  "flex-1 text-left text-lg font-semibold",
                  isCompleted && "line-through text-muted-foreground"
                )}
              >
                {title || task.title}
              </button>
            )}
          </div>

          {/* Description */}
          {isEditingDescription ? (
            <div className="py-3 border-b border-border/40">
              <Textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionSave}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDescription(task.description || "");
                    setIsEditingDescription(false);
                  }
                }}
                autoFocus
                rows={3}
                placeholder="Add a description..."
                className="resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent"
              />
            </div>
          ) : hasDescription ? (
            <PropertyRow
              icon={AlignLeft}
              onClick={() => setIsEditingDescription(true)}
            >
              <p className="text-sm text-foreground line-clamp-2">
                {task.description}
              </p>
            </PropertyRow>
          ) : null}

          {/* Populated Properties */}

          {/* Due Date - if set */}
          {hasDueDate && (
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <PropertyRow icon={Calendar}>
                  <span className={cn("text-sm", isTaskOverdue && !isCompleted && "text-red-500")}>
                    {formatDueDate(task.due_date!)}
                  </span>
                </PropertyRow>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={task.due_date ? new Date(task.due_date) : undefined}
                  onSelect={handleDueDateChange}
                  initialFocus
                />
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
              </PopoverContent>
            </Popover>
          )}

          {/* Assignee - if set */}
          {hasAssignee && assignee && (
            <Select
              value={task.assignee_id || "__none__"}
              onValueChange={handleAssigneeChange}
              open={assigneeSelectOpen}
              onOpenChange={setAssigneeSelectOpen}
            >
              <SelectTrigger className="w-full border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/30 rounded-none">
                <div className="flex items-center gap-3 w-full py-3 border-b border-border/40 text-left">
                  <User className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignee.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(assignee.display_name, assignee.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{assignee.display_name || assignee.email}</span>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent position="popper" side="top" align="start">
                <SelectItem value="__none__">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Unassigned</span>
                  </div>
                </SelectItem>
                {assignableProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(profile.display_name, profile.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.display_name || profile.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Priority */}
          <Select
            value={task.priority}
            onValueChange={handlePriorityChange}
            open={prioritySelectOpen}
            onOpenChange={setPrioritySelectOpen}
          >
            <SelectTrigger className={cn(
              "w-full border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/30 rounded-none",
              priorityConfig.color
            )}>
              <div className="flex items-center gap-3 w-full py-3 border-b border-border/40 text-left">
                <Flag className="h-5 w-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{priorityConfig.label}</span>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent position="popper" side="top" align="start">
              <SelectItem value="urgent">
                <div className="flex items-center gap-2 text-red-500">
                  <Flag className="h-4 w-4" />
                  <span>Priority 1</span>
                </div>
              </SelectItem>
              <SelectItem value="high">
                <div className="flex items-center gap-2 text-orange-500">
                  <Flag className="h-4 w-4" />
                  <span>Priority 2</span>
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex items-center gap-2 text-blue-500">
                  <Flag className="h-4 w-4" />
                  <span>Priority 3</span>
                </div>
              </SelectItem>
              <SelectItem value="low">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Flag className="h-4 w-4" />
                  <span>Priority 4</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Timer */}
          <div className="flex items-center gap-3 w-full py-3 border-b border-border/40">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              {totalTime > 0 && (
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {formattedTotalTime} tracked
                </span>
              )}
              <TimerButton
                entityType="task"
                entityId={task.id}
                entityName={task.title}
                size="sm"
                showLabel={true}
              />
            </div>
          </div>

          {/* Empty Properties Chips - Horizontal scroll */}
          {(emptyPropertyChips.length > 0 || !hasDescription || !hasAssignee || !hasDueDate) && (
            <div className="py-3 -mx-4 px-4 overflow-x-auto">
              <div className="flex items-center gap-2">
                {/* Description chip if empty */}
                {!hasDescription && (
                  <PropertyChip
                    icon={AlignLeft}
                    label="Description"
                    onClick={() => setIsEditingDescription(true)}
                  />
                )}
                {emptyPropertyChips.map((chip) => (
                  <PropertyChip
                    key={chip.id}
                    icon={chip.icon}
                    label={chip.label}
                    onClick={chip.onClick}
                    variant={chip.variant}
                  />
                ))}
                {/* Date chip with Popover - rendered separately for proper positioning */}
                {!hasDueDate && (
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 bg-muted/50 text-muted-foreground hover:bg-muted"
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Date</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" side="top" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={undefined}
                        onSelect={handleDueDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {/* Assignee chip with Popover - rendered separately for proper positioning */}
                {!hasAssignee && assignableProfiles.length > 0 && (
                  <Popover open={assigneeSelectOpen} onOpenChange={setAssigneeSelectOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 bg-muted/50 text-muted-foreground hover:bg-muted"
                      >
                        <User className="h-4 w-4" />
                        <span>Assignee</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" side="top" align="start">
                      {assignableProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => handleAssigneeChange(profile.id)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(profile.display_name, profile.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{profile.display_name || profile.email}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          {(showAttachments || attachments.length > 0) && (
            <div className="py-3 border-t border-border/40 mt-3">
              <button
                type="button"
                onClick={() => setShowAttachments(!showAttachments)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full mb-3"
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
                <div className="space-y-4">
                  <FileUpload
                    onUpload={uploadFile}
                    uploading={uploading}
                    className="py-4"
                  />
                  <AttachmentsList
                    attachments={attachments}
                    onDownload={downloadFile}
                    onDelete={deleteAttachment}
                  />
                </div>
              )}
            </div>
          )}

          {/* Time Entries Section */}
          {(showTimeEntries || timeEntries.filter(e => e.end_time).length > 0) && (
            <div className="py-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowTimeEntries(!showTimeEntries)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full mb-3"
              >
                {showTimeEntries ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Clock className="h-4 w-4" />
                <span>Time Entries</span>
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

              {showTimeEntries && (
                <TimeEntryList
                  entityType="task"
                  entityId={task.id}
                  hideHeader
                />
              )}
            </div>
          )}

          {/* Created by info */}
          {task.created_at && (
            <div className="pt-4 mt-4 border-t border-border/40 text-[10px] text-muted-foreground text-right">
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
      </DrawerContent>
    </Drawer>
  );
}
