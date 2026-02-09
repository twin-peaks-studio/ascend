/**
 * Client-side utility to send Inngest events via the API proxy.
 *
 * Hooks call this after successful mutations. Events are sent to
 * /api/inngest/events which authenticates and forwards to Inngest.
 */

import { logger } from "@/lib/logger/logger";

type InngestEvent = {
  name: string;
  data: Record<string, unknown>;
};

/**
 * Sends one or more events to Inngest via the server-side proxy.
 * Failures are logged but never throw — notifications are non-blocking.
 */
export async function sendInngestEvents(events: InngestEvent[]): Promise<void> {
  try {
    const response = await fetch("/api/inngest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      logger.error("Failed to send Inngest events", {
        status: response.status,
        body,
        eventNames: events.map((e) => e.name),
      });
    }
  } catch (error) {
    // Non-blocking — don't fail the mutation because of a notification issue
    logger.error("Error sending Inngest events", { error });
  }
}
