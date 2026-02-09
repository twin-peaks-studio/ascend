"use client";

import { useState } from "react";
import { User, Calendar, Flag, X, Users, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";
import type { ProjectWithRelations, TaskPriority, ProjectStatus } from "@/types";
import type { Profile } from "@/types";
import { PROJECT_STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_COLORS } from "@/types";
import { useProjectAssignees } from "@/hooks/use-project-assignees";

interface SidebarRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

function SidebarRow({ label, children, className }: SidebarRowProps) {
  return (
    <div className={cn("py-3 border-b border-border/40", className)}>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

interface PropertiesPanelProps {
  project: ProjectWithRelations;
  profiles: Profile[];
  membersCount: number;
  projectMutationLoading: boolean;
  onStatusChange: (status: string) => void;
  onLeadChange: (leadId: string | null) => void;
  onDueDateChange: (date: Date | null) => void;
  onPriorityChange: (priority: string) => void;
  onColorChange: (color: string) => void;
  onShowMembers: () => void;
  totalProjectTime?: string;
  onShowTimeReport?: () => void;
}

export function PropertiesPanel({
  project,
  profiles,
  membersCount,
  projectMutationLoading,
  onStatusChange,
  onLeadChange,
  onDueDateChange,
  onPriorityChange,
  onColorChange,
  onShowMembers,
  totalProjectTime,
  onShowTimeReport,
}: PropertiesPanelProps) {
  const statusConfig = PROJECT_STATUS_CONFIG[project.status];

  // Filter lead options to only show project members
  const { assignableProfiles: leadProfiles } = useProjectAssignees(project.id, profiles);

  // Local state for date + time selection before committing
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDueDate, setPendingDueDate] = useState<Date | null>(
    project.due_date ? new Date(project.due_date) : null
  );

  // Render-time sync when project.due_date changes externally
  const [prevDueDate, setPrevDueDate] = useState<string | null>(project.due_date ?? null);
  if (project.due_date !== prevDueDate) {
    setPrevDueDate(project.due_date ?? null);
    if (!datePickerOpen) {
      setPendingDueDate(project.due_date ? new Date(project.due_date) : null);
    }
  }

  const handleDueDateSelect = (date: Date | undefined) => {
    if (!date) {
      setPendingDueDate(null);
      return;
    }
    if (pendingDueDate) {
      date.setHours(pendingDueDate.getHours(), pendingDueDate.getMinutes(), 0, 0);
    }
    setPendingDueDate(date);
  };

  const handleDueTimeChange = (date: Date) => {
    setPendingDueDate(date);
  };

  const handleDatePickerOpenChange = (open: boolean) => {
    if (!open && datePickerOpen) {
      // Save on close
      onDueDateChange(pendingDueDate);
    }
    setDatePickerOpen(open);
  };

  const handleClearProjectDueDate = () => {
    setPendingDueDate(null);
    onDueDateChange(null);
    setDatePickerOpen(false);
  };

  return (
    <div className="space-y-0">
      {/* Status */}
      <SidebarRow label="Status">
        <Select
          value={project.status}
          onValueChange={onStatusChange}
          disabled={projectMutationLoading}
        >
          <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-2 px-2 rounded">
            <SelectValue>
              <Badge
                variant="secondary"
                className={cn("text-xs", statusConfig.color, statusConfig.bgColor)}
              >
                {statusConfig.label}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              <Badge
                variant="secondary"
                className={cn("text-xs", PROJECT_STATUS_CONFIG.active.color, PROJECT_STATUS_CONFIG.active.bgColor)}
              >
                Active
              </Badge>
            </SelectItem>
            <SelectItem value="completed">
              <Badge
                variant="secondary"
                className={cn("text-xs", PROJECT_STATUS_CONFIG.completed.color, PROJECT_STATUS_CONFIG.completed.bgColor)}
              >
                Completed
              </Badge>
            </SelectItem>
            <SelectItem value="archived">
              <Badge
                variant="secondary"
                className={cn("text-xs", PROJECT_STATUS_CONFIG.archived.color, PROJECT_STATUS_CONFIG.archived.bgColor)}
              >
                Archived
              </Badge>
            </SelectItem>
          </SelectContent>
        </Select>
      </SidebarRow>

      {/* Lead */}
      <SidebarRow label="Lead">
        <Select
          value={project.lead_id || "none"}
          onValueChange={(val) => onLeadChange(val === "none" ? null : val)}
          disabled={projectMutationLoading}
        >
          <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-2 px-2 rounded">
            <SelectValue>
              {(() => {
                const leadProfile = project.lead_id
                  ? profiles.find((p) => p.id === project.lead_id)
                  : null;
                if (leadProfile) {
                  return (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={leadProfile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {leadProfile.display_name
                            ? leadProfile.display_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            : leadProfile.email?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">
                        {leadProfile.display_name || leadProfile.email || "Unknown"}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>No lead</span>
                  </div>
                );
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>No lead</span>
              </div>
            </SelectItem>
            {leadProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {profile.display_name
                        ? profile.display_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : profile.email?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span>{profile.display_name || profile.email || "Unknown"}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarRow>

      {/* Due Date */}
      <SidebarRow label="Due Date">
        <div className="flex items-center gap-2 -mx-2 px-2">
          <Popover open={datePickerOpen} onOpenChange={handleDatePickerOpenChange}>
            <PopoverTrigger asChild>
              <button
                disabled={projectMutationLoading}
                className={cn(
                  "flex items-center gap-2 py-1 rounded hover:bg-muted/50 text-left flex-1",
                  !project.due_date && "text-muted-foreground"
                )}
              >
                <Calendar className="h-4 w-4" />
                {project.due_date ? (
                  <span
                    className={cn(
                      new Date(project.due_date) < new Date() && "text-red-500"
                    )}
                  >
                    {(() => {
                      const date = new Date(project.due_date);
                      const today = new Date();
                      const tomorrow = new Date(today);
                      tomorrow.setDate(tomorrow.getDate() + 1);

                      if (date.toDateString() === today.toDateString()) {
                        return "Today";
                      } else if (date.toDateString() === tomorrow.toDateString()) {
                        return "Tomorrow";
                      } else {
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    })()}
                  </span>
                ) : (
                  <span>No due date</span>
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
              {pendingDueDate && (
                <>
                  <div className="border-t" />
                  <TimePicker value={pendingDueDate} onChange={handleDueTimeChange} />
                </>
              )}
            </PopoverContent>
          </Popover>
          {project.due_date && (
            <button
              onClick={handleClearProjectDueDate}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </SidebarRow>

      {/* Priority */}
      <SidebarRow label="Priority">
        <Select
          value={project.priority || "medium"}
          onValueChange={onPriorityChange}
          disabled={projectMutationLoading}
        >
          <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 hover:bg-muted/50 -mx-2 px-2 rounded">
            <SelectValue>
              {(() => {
                const priority = project.priority || "medium";
                return (
                  <div className="flex items-center gap-2">
                    <Flag
                      className={cn(
                        "h-4 w-4",
                        priority === "urgent" && "text-red-500",
                        priority === "high" && "text-amber-500",
                        priority === "medium" && "text-blue-500",
                        priority === "low" && "text-muted-foreground"
                      )}
                    />
                    <span>{PRIORITY_CONFIG[priority].label}</span>
                  </div>
                );
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                <span>Urgent</span>
              </div>
            </SelectItem>
            <SelectItem value="high">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-amber-500" />
                <span>High</span>
              </div>
            </SelectItem>
            <SelectItem value="medium">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-blue-500" />
                <span>Medium</span>
              </div>
            </SelectItem>
            <SelectItem value="low">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span>Low</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </SidebarRow>

      {/* Color */}
      <SidebarRow label="Color">
        <div className="flex flex-wrap gap-2 mt-1">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              disabled={projectMutationLoading}
              className={cn(
                "h-6 w-6 rounded-full transition-all",
                "ring-2 ring-offset-2 ring-offset-background",
                project.color === c ? "ring-primary" : "ring-transparent hover:ring-muted"
              )}
              style={{ backgroundColor: c }}
            >
              <span className="sr-only">Select color {c}</span>
            </button>
          ))}
        </div>
      </SidebarRow>

      {/* Team Members */}
      <SidebarRow label="Team">
        <button
          onClick={onShowMembers}
          className="flex items-center gap-2 -mx-2 px-2 py-1 rounded hover:bg-muted/50 w-full text-left"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>
            {membersCount === 0
              ? "No members"
              : membersCount === 1
              ? "1 member"
              : `${membersCount} members`}
          </span>
        </button>
      </SidebarRow>

      {/* Time Report */}
      <SidebarRow label="Time" className="border-b-0">
        <button
          onClick={onShowTimeReport}
          className="flex items-center gap-2 -mx-2 px-2 py-1 rounded hover:bg-muted/50 w-full text-left"
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            {totalProjectTime || "No time tracked"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </SidebarRow>
    </div>
  );
}
