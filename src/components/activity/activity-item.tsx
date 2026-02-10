"use client";

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
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/profile-utils";
import { formatTimeAgo } from "@/lib/format-time";
import type { ActivityLogWithActor, ActivityAction } from "@/types";

interface ActivityItemProps {
  activity: ActivityLogWithActor;
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

function getActivityMessage(action: string, details: Record<string, unknown>): string {
  const taskTitle = details.task_title as string | undefined;

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
    case "member_added":
      return "added a member to the project";
    case "member_removed":
      return "removed a member from the project";
    case "project_updated": {
      const changes: string[] = [];
      if (details.new_title) changes.push("title");
      if (details.new_status) changes.push("status");
      if (details.new_priority) changes.push("priority");
      if ("new_lead_id" in details) changes.push("lead");
      if ("new_due_date" in details) changes.push("due date");
      return `updated project ${changes.join(", ")}`;
    }
    default:
      return "made a change";
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { icon: Icon, className: iconClassName } = getActivityIcon(activity.action);
  const actorName =
    activity.actor?.display_name || activity.actor?.email || "System";
  const details = (activity.details || {}) as Record<string, unknown>;
  const message = getActivityMessage(activity.action, details);

  return (
    <div className="flex items-start gap-3 px-1 py-2.5">
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
