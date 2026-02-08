"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import {
  Calendar,
  Flag,
  User,
  FolderKanban,
  MoreHorizontal,
  Send,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type { Project, Profile, TaskPriority } from "@/types";
import { PRIORITY_OPTIONS } from "@/types";
import type { CreateTaskInput } from "@/lib/validation";
import { getInitials } from "@/lib/profile-utils";
import { formatDueDate } from "@/lib/date-utils";
import { useProjectAssignees } from "@/hooks/use-project-assignees";

interface QuickAddTaskProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  projects: Project[];
  profiles: Profile[];
  loading?: boolean;
  defaultAssigneeId?: string | null;
  defaultProjectId?: string | null;
}

/**
 * Property chip button for quick-add fields
 */
function PropertyChip({
  icon: Icon,
  label,
  onClick,
  active = false,
  color,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  active?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 border",
        active
          ? "bg-muted border-border"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", color)} />
      {label && <span className={color}>{label}</span>}
    </button>
  );
}

/**
 * Inner form component that resets on each mount
 */
function QuickAddTaskForm({
  onSubmit,
  onClose,
  projects,
  profiles,
  loading,
  defaultAssigneeId,
  defaultProjectId,
}: {
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  onClose: () => void;
  projects: Project[];
  profiles: Profile[];
  loading: boolean;
  defaultAssigneeId?: string | null;
  defaultProjectId?: string | null;
}) {
  // Form state - fresh on every mount
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(defaultAssigneeId ?? null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("medium");

  // UI state for popovers
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title input on mount
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Get assignable profiles based on selected project
  const { assignableProfiles, canAssign } = useProjectAssignees(projectId, profiles);

  // Clear assignee if project changes and current assignee is not in the new project's members
  // Valid use: data consistency when project changes
  useEffect(() => {
    if (assigneeId && !canAssign(assigneeId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssigneeId(null);
    }
  }, [assigneeId, canAssign, projectId]);

  const selectedProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const selectedAssignee = assigneeId ? assignableProfiles.find((p) => p.id === assigneeId) : null;
  const priorityConfig = PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[2];

  const handleSubmit = async () => {
    if (!title.trim() || loading) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      project_id: projectId,
      assignee_id: assigneeId,
      due_date: dueDate?.toISOString() || null,
      priority,
      status: "todo",
      position: 0,
    });

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = title.trim().length > 0 && !loading;

  return (
    <>
      {/* Main content */}
      <div className="flex flex-col px-4 pt-4 pb-2">
        {/* Title input with accent line */}
        <div className="flex items-start gap-3">
          <div className="w-0.5 h-6 bg-primary rounded-full mt-2 shrink-0" />
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task Name"
            className="flex-1 border-0 p-0 text-lg font-medium placeholder:text-muted-foreground/60 focus-visible:ring-0 shadow-none bg-transparent h-auto"
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div className="pl-5 mt-1">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="border-0 p-0 min-h-[24px] resize-none text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 shadow-none bg-transparent"
            rows={1}
            maxLength={5000}
          />
        </div>

        {/* Property chips - horizontal scroll */}
        <div className="mt-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex items-center gap-2 pb-2">
            {/* Date chip */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 border",
                    dueDate
                      ? "bg-muted border-border"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{dueDate ? formatDueDate(dueDate) : "Date"}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dueDate || undefined}
                  onSelect={(date) => {
                    setDueDate(date || null);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
                {dueDate && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDueDate(null);
                        setDatePickerOpen(false);
                      }}
                    >
                      Clear date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Priority chip */}
            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 border",
                    priority !== "medium"
                      ? "bg-muted border-border"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <Flag className={cn("h-4 w-4", priorityConfig.color)} />
                  <span className={priorityConfig.color}>{priorityConfig.label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPriority(option.value);
                      setPriorityOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors",
                      option.color
                    )}
                  >
                    <Flag className="h-4 w-4" />
                    <span className="flex-1">{option.label}</span>
                    {priority === option.value && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Assignee chip */}
            {assignableProfiles.length > 0 && (
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  {selectedAssignee ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 border bg-muted border-border"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={selectedAssignee.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(selectedAssignee.display_name, selectedAssignee.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[80px] truncate">
                        {selectedAssignee.display_name || selectedAssignee.email}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 border border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      <span>Assignee</span>
                    </button>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeId(null);
                      setAssigneeOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <User className="h-4 w-4" />
                    <span className="flex-1">Unassigned</span>
                    {!assigneeId && <Check className="h-4 w-4" />}
                  </button>
                  {assignableProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => {
                        setAssigneeId(profile.id);
                        setAssigneeOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(profile.display_name, profile.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{profile.display_name || profile.email}</span>
                      {assigneeId === profile.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* More options chip */}
            <PropertyChip
              icon={MoreHorizontal}
              label=""
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              active={showMoreOptions}
            />
          </div>
        </div>

        {/* Additional options when expanded */}
        {showMoreOptions && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground mb-2">
              More options are available in the full task editor after creation.
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar with project selector and send button */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/30">
        {/* Project selector */}
        <Popover open={projectOpen} onOpenChange={setProjectOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedProject ? (
                <>
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: selectedProject.color }}
                  />
                  <span className="max-w-[150px] truncate">{selectedProject.title}</span>
                </>
              ) : (
                <>
                  <FolderKanban className="h-4 w-4" />
                  <span>Inbox</span>
                </>
              )}
              <svg
                className="h-3 w-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            <button
              type="button"
              onClick={() => {
                setProjectId(null);
                setProjectOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              <FolderKanban className="h-4 w-4" />
              <span className="flex-1">Inbox (No project)</span>
              {!projectId && <Check className="h-4 w-4" />}
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setProjectId(project.id);
                  setProjectOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="flex-1 truncate">{project.title}</span>
                {projectId === project.id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all",
            canSubmit
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          aria-label="Create task"
        >
          {loading ? (
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </>
  );
}

export function QuickAddTask({
  open,
  onOpenChange,
  onSubmit,
  projects,
  profiles,
  loading = false,
  defaultAssigneeId,
  defaultProjectId,
}: QuickAddTaskProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerTitle className="sr-only">Add task</DrawerTitle>
        {/* Only render form when drawer is open - unmounts on close which resets state */}
        {open && (
          <QuickAddTaskForm
            onSubmit={onSubmit}
            onClose={() => onOpenChange(false)}
            projects={projects}
            profiles={profiles}
            loading={loading}
            defaultAssigneeId={defaultAssigneeId}
            defaultProjectId={defaultProjectId}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
