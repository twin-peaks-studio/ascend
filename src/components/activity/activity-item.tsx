"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserMinus,
  MessageSquare,
  Plus,
  Trash2,
  ArrowUpDown,
  Settings2,
  StickyNote,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/profile-utils";
import { formatTimeAgo } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import type { ActivityLogWithActor, ActivityAction } from "@/types";

interface ActivityItemProps {
  activity: ActivityLogWithActor;
  projectId: string;
}

function getActivityIcon(action: string): { icon: LucideIcon; className: string } {
  switch (action as ActivityAction) {
    case "task_created":
      return { icon: Plus, className: "text-green-600 dark:text-green-400" };
    case "task_status_changed":
      return { icon: CheckCircle2, className: "text-blue-600 dark:text-blue-400" };
    case "task_priority_changed":
      return { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" };
    case "task_assigned":
      return { icon: UserPlus, className: "text-purple-600 dark:text-purple-400" };
    case "task_deleted":
      return { icon: Trash2, className: "text-red-600 dark:text-red-400" };
    case "comment_added":
      return { icon: MessageSquare, className: "text-sky-600 dark:text-sky-400" };
    case "member_added":
      return { icon: UserPlus, className: "text-green-600 dark:text-green-400" };
    case "member_removed":
      return { icon: UserMinus, className: "text-red-600 dark:text-red-400" };
    case "project_updated":
      return { icon: Settings2, className: "text-muted-foreground" };
    case "note_created":
      return { icon: StickyNote, className: "text-green-600 dark:text-green-400" };
    case "note_updated":
      return { icon: Pencil, className: "text-blue-600 dark:text-blue-400" };
    case "note_deleted":
      return { icon: Trash2, className: "text-red-600 dark:text-red-400" };
    default:
      return { icon: ArrowUpDown, className: "text-muted-foreground" };
  }
}

function formatStatus(status: string): string {
  if (status === "in-progress") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPriority(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getActivityMessage(action: string, details: Record<string, unknown>): string {
  const taskTitle = details.task_title as string | undefined;
  const noteTitle = details.note_title as string | undefined;

  switch (action as ActivityAction) {
    case "task_created":
      return `created task \u201c${taskTitle}\u201d`;
    case "task_status_changed":
      return `moved \u201c${taskTitle}\u201d from ${formatStatus(details.old_status as string)} to ${formatStatus(details.new_status as string)}`;
    case "task_priority_changed":
      return `changed \u201c${taskTitle}\u201d priority from ${formatPriority(details.old_priority as string)} to ${formatPriority(details.new_priority as string)}`;
    case "task_assigned":
      if (details.new_assignee_id) {
        return `assigned \u201c${taskTitle}\u201d`;
      }
      return `unassigned \u201c${taskTitle}\u201d`;
    case "task_deleted":
      return `deleted task \u201c${taskTitle}\u201d`;
    case "comment_added": {
      const preview = details.comment_preview as string | undefined;
      if (preview) {
        const truncated = preview.length >= 100 ? preview + "\u2026" : preview;
        return `commented: \u201c${truncated}\u201d`;
      }
      return "added a comment";
    }
    case "member_added": {
      const memberName = details.member_name as string | undefined;
      return memberName
        ? `added ${memberName} to the project`
        : "added a member to the project";
    }
    case "member_removed": {
      const memberName = details.member_name as string | undefined;
      return memberName
        ? `removed ${memberName} from the project`
        : "removed a member from the project";
    }
    case "project_updated": {
      const parts: string[] = [];

      if (details.new_title && details.old_title) {
        parts.push(`renamed project from \u201c${details.old_title}\u201d to \u201c${details.new_title}\u201d`);
      }
      if (details.new_status && details.old_status) {
        parts.push(`changed status from ${formatStatus(details.old_status as string)} to ${formatStatus(details.new_status as string)}`);
      }
      if (details.new_priority && details.old_priority) {
        parts.push(`changed priority from ${formatPriority(details.old_priority as string)} to ${formatPriority(details.new_priority as string)}`);
      }
      if ("new_lead_id" in details) {
        const oldLead = details.old_lead_name as string | undefined;
        const newLead = details.new_lead_name as string | undefined;
        if (oldLead && newLead) {
          parts.push(`changed lead from ${oldLead} to ${newLead}`);
        } else if (newLead) {
          parts.push(`set lead to ${newLead}`);
        } else if (oldLead) {
          parts.push(`removed ${oldLead} as lead`);
        }
      }
      if ("new_due_date" in details) {
        const oldDate = details.old_due_date as string | null;
        const newDate = details.new_due_date as string | null;
        if (oldDate && newDate) {
          parts.push(`changed due date from ${formatDate(oldDate)} to ${formatDate(newDate)}`);
        } else if (newDate) {
          parts.push(`set due date to ${formatDate(newDate)}`);
        } else {
          parts.push("removed the due date");
        }
      }

      return parts.length > 0 ? parts.join(", ") : "updated project settings";
    }
    case "note_created":
      return `created note \u201c${noteTitle}\u201d`;
    case "note_updated":
      return `updated note \u201c${noteTitle}\u201d`;
    case "note_deleted":
      return `deleted note \u201c${noteTitle}\u201d`;
    default:
      return "made a change";
  }
}

/**
 * Returns a link path if this activity item should be clickable.
 * Returns null for deleted items or items without a navigable target.
 */
function getActivityLink(
  action: string,
  details: Record<string, unknown>,
  taskId: string | null,
  projectId: string
): string | null {
  switch (action as ActivityAction) {
    case "task_created":
    case "task_status_changed":
    case "task_priority_changed":
    case "task_assigned":
    case "comment_added":
      return taskId ? `/tasks/${taskId}` : null;
    case "note_created":
    case "note_updated": {
      const noteId = details.note_id as string | undefined;
      return noteId ? `/projects/${projectId}/notes/${noteId}` : null;
    }
    // Deleted items — no navigation
    case "task_deleted":
    case "note_deleted":
    case "member_added":
    case "member_removed":
    case "project_updated":
    default:
      return null;
  }
}

export function ActivityItem({ activity, projectId }: ActivityItemProps) {
  const router = useRouter();
  const { icon: Icon, className: iconClassName } = getActivityIcon(activity.action);
  const actorName =
    activity.actor?.display_name || activity.actor?.email || "System";
  const details = (activity.details || {}) as Record<string, unknown>;
  const message = getActivityMessage(activity.action, details);
  const link = getActivityLink(activity.action, details, activity.task_id, projectId);

  const handleClick = () => {
    if (link) {
      router.push(link);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-1 py-2.5",
        link && "cursor-pointer rounded-md hover:bg-accent/50 transition-colors"
      )}
      onClick={handleClick}
    >
      <div className={`mt-0.5 flex-shrink-0 ${iconClassName}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-medium">{actorName}</span>{" "}
          <span className="text-muted-foreground">{message}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimeAgo(activity.created_at)}
        </p>
      </div>
      {activity.actor && (
        <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
          <AvatarImage src={activity.actor.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(activity.actor.display_name, activity.actor.email)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
