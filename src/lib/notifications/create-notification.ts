import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";

/**
 * Central notification creation utility.
 *
 * All notification types go through this module so notification logic
 * isn't scattered across the codebase.
 */

interface BaseNotificationParams {
  /** The user who will receive the notification */
  recipientId: string;
  /** The user who performed the action */
  actorId: string;
  taskId?: string | null;
  projectId?: string | null;
  commentId?: string | null;
}

/**
 * Insert a notification row. Returns true if successful.
 */
async function insertNotification(
  params: BaseNotificationParams & { type: string }
): Promise<boolean> {
  // Don't notify yourself
  if (params.recipientId === params.actorId) return false;

  const supabase = getClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: params.recipientId,
    actor_id: params.actorId,
    type: params.type,
    task_id: params.taskId ?? null,
    project_id: params.projectId ?? null,
    comment_id: params.commentId ?? null,
  });

  if (error) {
    logger.error("Failed to create notification", {
      type: params.type,
      recipientId: params.recipientId,
      error,
    });
    return false;
  }

  return true;
}

/**
 * Notify a user that they were @mentioned in a comment.
 */
export async function notifyMention(params: BaseNotificationParams) {
  return insertNotification({ ...params, type: "mention" });
}

/**
 * Notify a user that a task was assigned to them.
 */
export async function notifyTaskAssigned(params: {
  recipientId: string;
  actorId: string;
  taskId: string;
  projectId?: string | null;
}) {
  return insertNotification({ ...params, type: "task_assigned" });
}

/**
 * Notify a user that they were removed as task assignee.
 */
export async function notifyTaskUnassigned(params: {
  recipientId: string;
  actorId: string;
  taskId: string;
  projectId?: string | null;
}) {
  return insertNotification({ ...params, type: "task_unassigned" });
}

/**
 * Notify a user that they were invited to a project.
 */
export async function notifyProjectInvited(params: {
  recipientId: string;
  actorId: string;
  projectId: string;
}) {
  return insertNotification({ ...params, type: "project_invited" });
}

/**
 * Notify a user that they were made project lead.
 */
export async function notifyProjectLeadAssigned(params: {
  recipientId: string;
  actorId: string;
  projectId: string;
}) {
  return insertNotification({ ...params, type: "project_lead_assigned" });
}

/**
 * Notify a user that they were removed as project lead.
 */
export async function notifyProjectLeadRemoved(params: {
  recipientId: string;
  actorId: string;
  projectId: string;
}) {
  return insertNotification({ ...params, type: "project_lead_removed" });
}
