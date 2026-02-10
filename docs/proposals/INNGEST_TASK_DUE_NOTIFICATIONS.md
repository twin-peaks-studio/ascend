# Proposal: Task Due Notifications via Inngest

> **Status:** Implemented
> **Date:** February 9, 2026
> **Scope:** Phase 3 — Team Collaboration (#18 Notifications & Activity)

---

## Problem

Users need to be notified when tasks are approaching their due date — even if they haven't opened the app. Today, the notification system handles real-time events (mentions, assignments, project invites) but has no mechanism for **time-based** notifications. We need a backend-driven solution that:

1. Fires at a precise future time (e.g., 1 hour before a task is due)
2. Can be cancelled if the task is completed or the due date is removed
3. Can be rescheduled if the due date changes
4. Works when the user is offline (foundation for email and mobile push)

---

## Why Inngest

Inngest is a durable workflow engine purpose-built for this pattern. Instead of polling a database on a cron schedule, Inngest lets us **schedule a function to wake up at a specific time** and **cancel it automatically via events**.

### How It Compares

| Approach | Precision | Cancellation | Multi-step escalation | New dependency |
|----------|-----------|--------------|----------------------|----------------|
| Vercel Cron + polling table | ~1-5 min lag | Manual DELETE | Manual (complex) | None |
| QStash delayed message | Exact | Manual (store messageId) | Not built-in | Upstash (already used) |
| **Inngest** | **Exact** | **Automatic (event-based)** | **Built-in** | **Inngest** |

### Key Advantages

- **Event-driven cancellation**: Fire a `task/completed` event and Inngest cancels all sleeping functions for that task. No message IDs to track, no rows to delete, no race conditions.
- **Durable sleep**: A `sleepUntil` call costs zero compute while sleeping. The function is re-invoked at the scheduled time.
- **Multi-step with checkpointing**: Each step is individually retried on failure. If "send email" fails, it retries from that step — not from the beginning.
- **Observability**: Dashboard shows all pending, sleeping, running, and failed functions.
- **Self-hostable**: Inngest is open-source (SSPL). Can self-host with SQLite or PostgreSQL if needed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        TRIGGER POINTS                        │
│                                                              │
│  Task created with due_date ─────► event: task/due-date.set │
│  Task due_date updated ──────────► event: task/due-date.set │
│                                    (old function cancelled   │
│                                     via task/due-date.updated│
│                                     + new one scheduled)     │
│  Task completed ─────────────────► event: task/completed     │
│  Task due_date removed ──────────► event: task/due-date.removed │
│  Task deleted ───────────────────► event: task/deleted       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     INNGEST FUNCTION                         │
│                  "task-due-reminder"                          │
│                                                              │
│  cancelOn:                                                   │
│    - event: task/completed        (match: data.taskId)       │
│    - event: task/due-date.updated (match: data.taskId)       │
│    - event: task/due-date.removed (match: data.taskId)       │
│    - event: task/deleted          (match: data.taskId)       │
│                                                              │
│  trigger: task/due-date.set                                  │
│                                                              │
│  Steps:                                                      │
│    1. sleepUntil(dueDate - 1 hour)                           │
│    2. Create in-app notification (INSERT into notifications) │
│    3. (Future) Send email via Resend                         │
│    4. (Future) Send push via FCM                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DELIVERY CHANNELS                         │
│                                                              │
│  In-app notification bell ◄── notifications table + realtime │
│  Email (future) ◄──────────── Resend (already in deps)       │
│  Mobile push (future) ◄────── FCM/APNs                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Events Schema

Four events govern the lifecycle of a task due reminder:

### `task/due-date.set`

Fired when a task is created with a due date or an existing task's due date is changed. This is the **trigger** that schedules the reminder function. One event is fired **per recipient** (assignee and/or creator), so a single due date change may produce 1 or 2 events.

```typescript
{
  name: "task/due-date.set",
  data: {
    taskId: string;       // Task UUID
    dueDate: string;      // ISO 8601 datetime
    assigneeId: string;   // Who to notify (assignee, or creator as fallback)
    taskTitle: string;     // For notification message
    projectId: string | null;
  }
}
```

### `task/due-date.updated`

Fired when a due date changes. This **cancels** the previous sleeping function (via `cancelOn`). A new `task/due-date.set` event is fired immediately after to schedule the updated reminder.

```typescript
{
  name: "task/due-date.updated",
  data: {
    taskId: string;       // Matches cancelOn
  }
}
```

### `task/due-date.removed`

Fired when a due date is cleared (set to null). Cancels the sleeping function.

```typescript
{
  name: "task/due-date.removed",
  data: {
    taskId: string;       // Matches cancelOn
  }
}
```

### `task/completed`

Fired when a task status changes to `"done"`. Cancels the sleeping function.

```typescript
{
  name: "task/completed",
  data: {
    taskId: string;       // Matches cancelOn
  }
}
```

### `task/deleted`

Fired when a task is deleted. Cancels the sleeping function.

```typescript
{
  name: "task/deleted",
  data: {
    taskId: string;       // Matches cancelOn
  }
}
```

---

## Inngest Function Definition

```typescript
// src/inngest/functions/task-due-reminder.ts

import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/service";

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
    const { taskId, dueDate, assigneeId, taskTitle, projectId } = event.data;

    // Calculate reminder time: 1 hour before due
    const reminderTime = new Date(new Date(dueDate).getTime() - 60 * 60 * 1000);

    // If due date is less than 1 hour from now, notify immediately
    const now = new Date();
    if (reminderTime > now) {
      await step.sleepUntil("wait-until-reminder-time", reminderTime);
    }

    // Step 1: Create in-app notification
    await step.run("create-notification", async () => {
      const supabase = createServiceClient();
      await supabase.from("notifications").insert({
        user_id: assigneeId,
        actor_id: assigneeId, // System-generated, actor = self
        type: "task_due",
        task_id: taskId,
        project_id: projectId,
      });
    });

    // Step 2 (future): Send email for high/urgent priority tasks
    // await step.run("send-email", async () => {
    //   await resend.emails.send({
    //     to: userEmail,
    //     subject: `Task due in 1 hour: ${taskTitle}`,
    //     ...
    //   });
    // });

    // Step 3 (future): Send push notification
    // await step.run("send-push", async () => {
    //   await sendFCMPush(deviceToken, { title, body });
    // });
  }
);
```

---

## File Structure

New files to create:

```
src/inngest/
├── client.ts                          # Inngest client instance
├── events.ts                          # Event type definitions
└── functions/
    └── task-due-reminder.ts           # The due date reminder function

src/app/api/inngest/
└── route.ts                           # Inngest serve handler (GET, POST, PUT)
```

Files to modify:

```
src/hooks/use-tasks.ts                 # Fire events on task create/update/complete/delete
src/components/notifications/
└── notification-bell.tsx              # Add "task_due" to getNotificationMessage()
src/lib/notifications/
└── create-notification.ts             # (Optional) Add notifyTaskDue for non-Inngest paths
```

---

## Integration Points in Existing Code

Events need to be fired from these locations in the codebase:

### 1. Task Created with Due Date

**File:** `src/hooks/use-tasks.ts` — `createTask` function

```typescript
// After successful task creation
if (newTask.due_date && newTask.assignee_id) {
  await inngest.send({
    name: "task/due-date.set",
    data: {
      taskId: newTask.id,
      dueDate: newTask.due_date,
      assigneeId: newTask.assignee_id,
      taskTitle: newTask.title,
      projectId: newTask.project_id,
    },
  });
}
```

### 2. Task Due Date Updated

**File:** `src/hooks/use-tasks.ts` — `updateTask` function

```typescript
// When due_date is in the update payload
if ("due_date" in input) {
  // Cancel existing reminder
  await inngest.send({ name: "task/due-date.updated", data: { taskId } });

  // Schedule new reminder if due_date is not null and task has an assignee
  if (input.due_date && updatedTask.assignee_id) {
    await inngest.send({
      name: "task/due-date.set",
      data: {
        taskId,
        dueDate: input.due_date,
        assigneeId: updatedTask.assignee_id,
        taskTitle: updatedTask.title,
        projectId: updatedTask.project_id,
      },
    });
  }
}
```

### 3. Task Completed

**File:** `src/hooks/use-tasks.ts` — `updateTask` function

```typescript
// When status changes to "done"
if (input.status === "done") {
  await inngest.send({ name: "task/completed", data: { taskId } });
}
```

### 4. Task Deleted

**File:** `src/hooks/use-tasks.ts` — `deleteTask` function

```typescript
// Before or after successful deletion
await inngest.send({ name: "task/deleted", data: { taskId } });
```

### 5. Task Assignee Changed (Edge Case)

**File:** `src/hooks/use-tasks.ts` — `updateTask` function

When the assignee changes on a task that already has a due date, we need to cancel the old reminder and schedule a new one for the new assignee.

```typescript
if ("assignee_id" in input && updatedTask.due_date) {
  // Cancel old (targets old assignee)
  await inngest.send({ name: "task/due-date.updated", data: { taskId } });

  // Schedule new for new assignee
  if (input.assignee_id) {
    await inngest.send({
      name: "task/due-date.set",
      data: {
        taskId,
        dueDate: updatedTask.due_date,
        assigneeId: input.assignee_id,
        taskTitle: updatedTask.title,
        projectId: updatedTask.project_id,
      },
    });
  }
}
```

---

## Event Sending: Client vs. Server

Inngest events must be sent from a **server-side context** (they require a signing key in production). Our hooks run client-side, so we have two options:

### Option A: API Route Proxy (Recommended)

Create a lightweight API route that receives event data and forwards to Inngest:

```
POST /api/inngest/events
Body: { name: "task/due-date.set", data: { ... } }
```

The hooks call this route after successful Supabase mutations. This keeps the Inngest signing key server-side.

### Option B: Supabase Database Webhook

Configure Supabase Database Webhooks to call an API route whenever the `tasks` table is modified. The route inspects the change and fires the appropriate Inngest event. This is cleaner (no client-side event sending) but adds Supabase webhook configuration.

### Recommendation

**Option A** for now — it's simpler and keeps event-firing logic colocated with the mutation logic in hooks. We can migrate to database webhooks later if we want to decouple further.

---

## Notification Bell Updates

Add `task_due` to the notification bell display:

```typescript
// src/components/notifications/notification-bell.tsx

function getNotificationMessage(type: string): string {
  switch (type) {
    // ... existing cases ...
    case "task_due":
      return "You have a task due in 1 hour";
    default:
      return "sent you a notification";
  }
}
```

For `task_due`, the actor is the system (actor_id = user_id), so the bell should display the task title instead of an actor name. Example: **"Design mockups" is due in 1 hour** rather than **"You" sent you a notification**.

---

## Free Tier Constraint: 7-Day Sleep Limit

On Inngest's free plan, `sleepUntil` is limited to **7 days**. Tasks with due dates further out will need a workaround.

### Workaround: Chained Sleep

```typescript
async ({ event, step }) => {
  const { dueDate } = event.data;
  const reminderTime = new Date(new Date(dueDate).getTime() - 60 * 60 * 1000);

  // Sleep in 7-day increments until we're within range
  let now = new Date();
  let iteration = 0;
  while (reminderTime.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
    await step.sleep(`wait-chunk-${iteration}`, "7d");
    now = new Date();
    iteration++;
  }

  // Final sleep until exact reminder time
  if (reminderTime > now) {
    await step.sleepUntil("wait-final", reminderTime);
  }

  // ... create notification, send email, etc.
};
```

This works but adds step executions. For a task due 30 days from now: 4 sleep steps + 1 notification step = 5 steps, well within the 1,000-step limit.

### When to Upgrade

At **$50/month** (paid plan), sleep extends to 1 year and the chained pattern becomes unnecessary. This is worth it once the team exceeds ~5,000 scheduled tasks/month.

### Self-Hosting Alternative

Self-hosting Inngest removes all sleep limits. Runs with a single command (`npx inngest-cli start`) using SQLite. Can be deployed on any VPS or via the [official Helm chart](https://github.com/inngest/inngest-helm) on Kubernetes.

---

## Implementation Plan

### Layer 1: Infrastructure Setup

1. Install `inngest` package
2. Create `src/inngest/client.ts` — Inngest client
3. Create `src/inngest/events.ts` — Event type definitions
4. Create `src/app/api/inngest/route.ts` — Serve handler
5. Create `src/app/api/inngest/events/route.ts` — Event proxy API route
6. Verify with `npx inngest-cli dev` that the function registers

### Layer 2: Core Function

7. Create `src/inngest/functions/task-due-reminder.ts`
8. Test with a task due 2 minutes from now
9. Verify notification appears in bell
10. Test cancellation by completing the task before it fires

### Layer 3: Hook Integration

11. Modify `src/hooks/use-tasks.ts`:
    - `createTask` → fire `task/due-date.set` if due_date + assignee exist
    - `updateTask` → fire appropriate events for due_date/status/assignee changes
    - `deleteTask` → fire `task/deleted`
12. Update `notification-bell.tsx` with `task_due` message
13. End-to-end test: create task with due date → see notification arrive

### Layer 4: Polish

14. Handle edge cases:
    - Task with due date but no assignee (notify creator instead?)
    - Due date in the past (notify immediately vs. skip)
    - Bulk operations (archiving multiple tasks)
15. Update documentation (changelog, wiki, technical guide)

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `inngest` | latest | Core SDK — client, functions, serve handler |

No other new dependencies required. Existing `resend` package handles future email integration.

---

## Environment Variables

```env
# Required in production (provided by Inngest dashboard after creating an app)
INNGEST_EVENT_KEY=xxx          # For sending events
INNGEST_SIGNING_KEY=xxx        # For verifying webhook authenticity

# Local development (automatic with inngest-cli dev)
# No env vars needed — dev server auto-discovers local functions
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inngest service outage | Due reminders don't fire | Built-in retries (up to 20 attempts). Add Vercel cron as fallback sweep for missed notifications. |
| Free tier sleep limit (7 days) | Tasks due >7 days out need chained sleep | Chained sleep pattern works. Upgrade to paid ($50/mo) or self-host when needed. |
| Event not sent (client-side failure) | Reminder never scheduled | Use database webhook (Option B) as a more reliable alternative later. |
| Duplicate notifications | User gets notified twice | Idempotent function ID + taskId means Inngest deduplicates. Add DB unique constraint as safety net. |
| Clock skew | Notification fires slightly early/late | Inngest guarantees delivery within seconds of scheduled time. Acceptable for "due in ~1 hour" use case. |

---

## Project Due Date Reminders (Implemented Feb 10, 2026)

The same durable workflow pattern has been extended to **projects**. When a project has a due date, background reminders are scheduled to fire 1 hour before the deadline.

### How It Works

- **Trigger event:** `project/due-date.set` — fired when a project due date is created or changed
- **Cancel events:** `project/completed`, `project/due-date.updated`, `project/due-date.removed`, `project/deleted`
- **Recipients:** The project lead (if set) **and** the project creator. If the lead and creator are the same person, only one reminder is created (deduplication via `Set`). If no lead is set, the creator still receives a reminder.
- **Notification type:** `project_due`

### Architecture

```
project/due-date.set ──► projectDueReminder function (one run per recipient)
  │                        │
  │  cancelOn:             │
  │    project/completed   │  sleepUntil(dueDate - 1h)
  │    project/due-date.updated  │
  │    project/due-date.removed  │
  │    project/deleted     │
  │                        ▼
  │                  Create notification
  │                  (user_id = leadId, type = "project_due")
  │
  │  Recipients (deduplicated via Set):
  │    - Lead (if set)
  │    - Creator (always)
```

### Files

- `src/inngest/functions/project-due-reminder.ts` — The durable function
- `src/inngest/events.ts` — Event type definitions (includes all `project/*` events)
- `src/hooks/use-projects.ts` — Fires events on project create/update/complete/delete

### Recipient Logic (Tasks and Projects)

Both tasks and projects follow the same recipient pattern:

| Scenario | Recipients |
|----------|-----------|
| Assignee/lead set, different from creator | **Both** assignee/lead and creator |
| Assignee/lead set, same as creator | Creator only (deduplicated) |
| No assignee/lead set | Creator only |

For **tasks**: recipients = `{assignee_id, created_by}` (deduplicated via `Set`).
For **projects**: recipients = `{lead_id, created_by}` (deduplicated via `Set`).

One `task/due-date.set` or `project/due-date.set` event is fired **per recipient**, creating independent Inngest function runs. All runs for the same task/project are cancelled together when a cancellation event fires (matching on `data.taskId` or `data.projectId`).

Changing the lead/assignee on an item with an existing due date cancels all old reminders and reschedules for the updated recipient set.

---

## Future Extensions

Once this foundation is in place, these become straightforward additions:

1. **Email notifications**: Add a `step.run("send-email")` using the existing Resend integration
2. **Mobile push**: Add a `step.run("send-push")` calling FCM/APNs
3. **Multi-stage escalation**: Sleep → notify in-app → sleep 30 min → email → sleep 30 min → push
4. **User preferences**: Check notification preferences table before each delivery step
5. **Overdue reminders**: After the due date passes, schedule a follow-up "task is overdue" notification
6. **Daily digest**: Inngest cron-triggered function that aggregates upcoming tasks into a single email
7. **Recurring reminders**: For tasks due far in the future, send weekly "still pending" nudges
