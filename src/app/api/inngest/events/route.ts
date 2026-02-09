/**
 * Inngest Event Proxy
 *
 * Receives events from client-side hooks and forwards them to Inngest.
 * This keeps the Inngest event key server-side while letting hooks fire events
 * after successful Supabase mutations.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/logger/logger";
const VALID_EVENT_NAMES = new Set<string>([
  "task/due-date.set",
  "task/due-date.updated",
  "task/due-date.removed",
  "task/completed",
  "task/deleted",
]);

export async function POST(request: NextRequest) {
  try {
    // Authenticate — only logged-in users can fire events
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { events } = body as {
      events: Array<{ name: string; data: Record<string, unknown> }>;
    };

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "Missing events array" }, { status: 400 });
    }

    // Validate event names to prevent arbitrary event injection
    for (const event of events) {
      if (!VALID_EVENT_NAMES.has(event.name)) {
        return NextResponse.json(
          { error: `Invalid event name: ${event.name}` },
          { status: 400 }
        );
      }
    }

    // Send all events to Inngest in a single batch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Runtime-validated proxy; events are validated above
    await inngest.send(events as any);

    return NextResponse.json({ sent: events.length });
  } catch (error) {
    logger.error("Failed to send Inngest events", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
