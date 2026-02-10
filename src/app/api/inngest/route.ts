import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { taskDueReminder } from "@/inngest/functions/task-due-reminder";
import { projectDueReminder } from "@/inngest/functions/project-due-reminder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [taskDueReminder, projectDueReminder],
});
