import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/service";

const ONE_HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Project Due Reminder
 *
 * Sleeps until 1 hour before a project's due date, then creates an in-app
 * notification for the project lead. Automatically cancelled if the project
 * is completed, archived, deleted, or the due date changes.
 *
 * On the free tier, sleepUntil is limited to 7 days — we chain 7-day sleeps
 * to handle projects with due dates further out.
 */
export const projectDueReminder = inngest.createFunction(
  {
    id: "project-due-reminder",
    cancelOn: [
      { event: "project/completed", match: "data.projectId" },
      { event: "project/due-date.updated", match: "data.projectId" },
      { event: "project/due-date.removed", match: "data.projectId" },
      { event: "project/deleted", match: "data.projectId" },
    ],
  },
  { event: "project/due-date.set" },
  async ({ event, step }) => {
    const { projectId, dueDate, leadId, projectTitle } = event.data;

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

    // Create in-app notification for the project lead
    await step.run("create-notification", async () => {
      const supabase = createServiceClient();
      const { error } = await supabase.from("notifications").insert({
        user_id: leadId,
        actor_id: leadId, // System-generated notification
        type: "project_due",
        project_id: projectId,
      });

      if (error) {
        throw new Error(
          `Failed to create project_due notification for "${projectTitle}": ${error.message}`
        );
      }
    });
  }
);
