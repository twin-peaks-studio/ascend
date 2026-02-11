"use client";

import { useEffect, useState, useRef } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { useAuth } from "@/hooks/use-auth";
import { logger } from "@/lib/logger/logger";
import type { RealtimeChannel } from "@supabase/supabase-js";

const HEARTBEAT_INTERVAL_MS = 15_000;
const STALENESS_CHECK_INTERVAL_MS = 10_000;
const STALENESS_THRESHOLD_MS = 30_000;

interface PresencePayload {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  last_active: number;
}

export interface PresenceUser extends PresencePayload {
  is_self: boolean;
}

export interface UsePresenceReturn {
  viewers: PresenceUser[];
  otherViewers: PresenceUser[];
  viewerCount: number;
  hasOtherViewers: boolean;
}

/**
 * Track and display real-time user presence on a task or project page.
 *
 * Uses Supabase Realtime Presence to broadcast who is currently viewing
 * a given entity. Handles multi-tab deduplication (same user in multiple
 * tabs appears once), heartbeat keep-alive (15s), and staleness removal
 * (users inactive >30s are filtered out).
 *
 * @param entityType - "task" or "project"
 * @param entityId - The ID of the entity, or null to disable
 */
export function usePresence(
  entityType: "task" | "project",
  entityId: string | null
): UsePresenceReturn {
  const { user, profile } = useAuth();
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const userId = user?.id ?? null;

  // Store profile in a ref so the heartbeat always reads the latest
  // without needing profile fields in the useEffect dependency array.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!entityId || !userId) return;

    const supabase = getClient();
    const channelName = `presence:${entityType}:${entityId}`;

    const buildPayload = (): PresencePayload => {
      const p = profileRef.current;
      return {
        user_id: userId,
        display_name: p?.display_name || p?.email || "Unknown",
        avatar_url: p?.avatar_url ?? null,
        email: p?.email ?? null,
        last_active: Date.now(),
      };
    };

    const processPresenceState = (channel: RealtimeChannel) => {
      const state = channel.presenceState<PresencePayload>();
      const now = Date.now();
      const userMap = new Map<string, PresencePayload>();

      // Flatten and deduplicate by user_id (keep most recent last_active)
      for (const key of Object.keys(state)) {
        for (const entry of state[key]) {
          const existing = userMap.get(entry.user_id);
          if (!existing || entry.last_active > existing.last_active) {
            userMap.set(entry.user_id, entry);
          }
        }
      }

      // Filter out stale users and mark self
      const activeUsers: PresenceUser[] = [];
      for (const [, payload] of userMap) {
        if (now - payload.last_active < STALENESS_THRESHOLD_MS) {
          activeUsers.push({
            ...payload,
            is_self: payload.user_id === userId,
          });
        }
      }

      // Sort: self first, then alphabetically by display_name
      activeUsers.sort((a, b) => {
        if (a.is_self) return -1;
        if (b.is_self) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

      setViewers(activeUsers);
    };

    const channel = supabase
      .channel(channelName)
      .on("presence", { event: "sync" }, () => {
        processPresenceState(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Presence channel subscribed", {
            channelName,
            userId,
          });
          await channel.track(buildPayload());
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Presence channel error", { channelName, userId });
        }
      });

    channelRef.current = channel;

    // Heartbeat: update last_active every 15s
    const heartbeatId = setInterval(() => {
      channel.track(buildPayload());
    }, HEARTBEAT_INTERVAL_MS);

    // Staleness re-check every 10s
    const stalenessId = setInterval(() => {
      processPresenceState(channel);
    }, STALENESS_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatId);
      clearInterval(stalenessId);
      supabase.removeChannel(channel);
      channelRef.current = null;
      logger.debug("Presence channel cleaned up", { channelName });
    };
  }, [entityType, entityId, userId]); // Only primitive deps

  const otherViewers = viewers.filter((v) => !v.is_self);

  return {
    viewers,
    otherViewers,
    viewerCount: viewers.length,
    hasOtherViewers: otherViewers.length > 0,
  };
}
