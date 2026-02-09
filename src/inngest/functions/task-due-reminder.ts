import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/service";

const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Task Due Reminder
 *
 * Sleeps until 1 hour before a task's due date, then creates an in-app notification.
 * Automatically cancelled if the task is completed, deleted, or the due date changes.
 *
 * On the free tier, sleepUntil is limited to 7 days — we chain 7-day sleeps
 * to handle tasks with due dates further out.
 */
export const taskDueReminder = inngest.createFunction(
  {
    id: "task-due-reminder",
    cancelOn: [
      { event: "task/completed", match: "data.taskId" },
      { event: "task/due-date.updated", match: "data.taskId" },
      { event: "task/due-date.removed", match: "data.taskId" },
      { event: "task/deleted", match: "data.taskId" },
    ],
  },
  { event: "task/due-date.set" },
  async ({ event, step }) => {
    const { taskId, dueDate, assigneeId, projectId } = event.data;

    // Calculate reminder time: 1 hour before due
    const reminderTime = new Date(new Date(dueDate).getTime() - ONE_HOUR_MS);
    let now = new Date();

    // If reminder time is in the past, fire immediately (skip all sleeps)
    if (reminderTime > now) {
      // Chain 7-day sleeps for free tier compatibility
      let iteration = 0;
      while (reminderTime.getTime() - now.getTime() > SEVEN_DAYS_MS) {
        await step.sleep(`wait-chunk-${iteration}`, "7d");
        now = new Date();
        iteration++;
      }

      // Final sleep until exact reminder time
      if (reminderTime > now) {
        await step.sleepUntil("wait-until-reminder-time", reminderTime);
      }
    }

    // Create in-app notification
    await step.run("create-notification", async () => {
      const supabase = createServiceClient();
      const { error } = await supabase.from("notifications").insert({
        user_id: assigneeId,
        actor_id: assigneeId, // System-generated notification
        type: "task_due",
        task_id: taskId,
        project_id: projectId,
      });

      if (error) {
        throw new Error(`Failed to create task_due notification: ${error.message}`);
      }
    });

    // Future: step.run("send-email", ...) for critical tasks
    // Future: step.run("send-push", ...) for mobile push
  }
);
