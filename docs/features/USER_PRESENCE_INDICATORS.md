# Feature #19: User Presence Indicators

**Status:** Ready for implementation
**Branch:** `claude/phase-3-next-feature-p99z1`
**Phase:** 3 (Team Collaboration)
**Roadmap:** `docs/roadmap/PHASE_3_ROADMAP.md`
**Created:** 2026-02-11

---

## Overview

Show who is currently viewing a task or project page in real time. When multiple team members view the same page, they see each other's avatars in the page header. Solo users see nothing — zero UI noise.

This is the last remaining feature in Phase 3 before tech debt cleanup and polish.

---

## Architecture Decision: Supabase Realtime Presence

The codebase already uses Supabase Realtime for `postgres_changes` events (tasks, comments, notifications, activity feed, timer sync). **Presence** is a separate Supabase Realtime capability that has NOT been used yet in this project.

Presence is ideal because:
- It uses the **existing WebSocket connection** (no new connections)
- It handles **join/leave/sync** events automatically
- It supports **server-side timeout** for abandoned connections
- The payload is tiny (a few hundred bytes per user)

### Scalability

For an enterprise org of 50-100 users:
- Only the 3-5 concurrent viewers of a specific task/project are on that channel
- The other 95+ users aren't subscribed — channels are per-entity, not global
- Avatar UI caps at 5 with "+N more" overflow
- Heartbeat is 1 tiny message per user per 15 seconds
- Supabase free tier supports 200 concurrent Realtime connections (shared across all features)

---

## Files to Create

### 1. `src/hooks/use-presence.ts`

Core hook that manages a Supabase Presence channel.

#### Hook Signature

```typescript
export function usePresence(
  entityType: "task" | "project",
  entityId: string | null
): UsePresenceReturn

interface UsePresenceReturn {
  viewers: PresenceUser[];       // All viewers, self first, then alphabetical
  otherViewers: PresenceUser[];  // Excluding current user
  viewerCount: number;
  hasOtherViewers: boolean;
}

interface PresenceUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  last_active: number;  // Date.now() timestamp
  is_self: boolean;
}
```

#### Channel Naming

```
presence:task:{taskId}
presence:project:{projectId}
```

Existing channels use patterns like `project:{id}:tasks`, `task:{id}:comments`, `user:{id}:notifications`, `project:{id}:activity`, `timer-sync-{id}`. The `presence:` prefix avoids all collisions.

#### Presence Payload (tracked per user)

```typescript
interface PresencePayload {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  last_active: number;  // Date.now()
}
```

#### Internal Logic

```
useEffect([entityType, entityId, userId]):
  1. Guard: if !entityId || !userId, return early
  2. Get supabase client via getClient()
  3. Create channel: supabase.channel(`presence:${entityType}:${entityId}`)
  4. Listen to 'presence' { event: 'sync' } → processPresenceState()
  5. Subscribe → on SUBSCRIBED, call channel.track(myPayload)
  6. Start heartbeat interval (15s) → channel.track({ ...payload, last_active: Date.now() })
  7. Start staleness check interval (10s) → re-run processPresenceState()
  8. Cleanup: clearInterval(both), supabase.removeChannel(channel)
```

#### processPresenceState()

```
1. Read channel.presenceState()
2. Flatten all entries
3. Deduplicate by user_id (keep entry with highest last_active)
   → This handles multi-tab: same user in 3 tabs = 1 entry
4. Filter out stale users (last_active > 30s ago)
5. Sort: is_self first, then alphabetical by display_name
6. setViewers(result)
```

#### Key Constants

```typescript
const HEARTBEAT_INTERVAL_MS = 15_000;      // Re-track every 15s
const STALENESS_CHECK_INTERVAL_MS = 10_000; // Check for stale users every 10s
const STALENESS_THRESHOLD_MS = 30_000;      // Remove users inactive > 30s
```

#### Dependency Array

```typescript
[entityType, entityId, userId]  // Only primitives — per CLAUDE.md guidelines
```

Do NOT include `profile` in the dependency array. The profile object loads asynchronously (see `use-auth.tsx` comment about non-blocking profile fetch). The heartbeat will naturally update display_name within 15s once the profile loads. This avoids unnecessary channel re-creation.

#### Pattern Reference

Follow the exact pattern from `src/hooks/use-realtime-tasks.ts`:
- `getClient()` from `@/lib/supabase/client-manager`
- `logger` from `@/lib/logger/logger`
- `useAuth()` from `@/hooks/use-auth`
- Guard with `if (!entityId || !userId) return`
- Cleanup with `supabase.removeChannel(channel)`

#### Full Implementation

```typescript
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

export function usePresence(
  entityType: "task" | "project",
  entityId: string | null
): UsePresenceReturn {
  const { user, profile } = useAuth();
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!entityId || !userId) return;

    const supabase = getClient();
    const channelName = `presence:${entityType}:${entityId}`;

    const myPayload: PresencePayload = {
      user_id: userId,
      display_name: profile?.display_name || profile?.email || "Unknown",
      avatar_url: profile?.avatar_url ?? null,
      email: profile?.email ?? null,
      last_active: Date.now(),
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
          logger.info("Presence channel subscribed", { channelName, userId });
          await channel.track(myPayload);
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Presence channel error", { channelName, userId });
        }
      });

    channelRef.current = channel;

    // Heartbeat: update last_active every 15s
    const heartbeatId = setInterval(() => {
      channel.track({ ...myPayload, last_active: Date.now() });
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
```

---

### 2. `src/components/shared/presence-avatars.tsx`

UI component rendering the presence avatar stack.

#### Props

```typescript
interface PresenceAvatarsProps {
  entityType: "task" | "project";
  entityId: string | null;
  maxVisible?: number;  // Default: 5
  className?: string;
}
```

#### Rendering Rules

1. Call `usePresence(entityType, entityId)`
2. If `hasOtherViewers === false` → return `null` (solo users see nothing)
3. Otherwise: render `Eye` icon + `AvatarGroup` + tooltip

#### Components Used

- `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, `AvatarGroupCount` from `@/components/ui/avatar`
- `Tooltip`, `TooltipTrigger`, `TooltipContent` from `@/components/ui/tooltip`
- `getInitials()` from `@/lib/profile-utils`
- `Eye` icon from `lucide-react`

#### Full Implementation

```typescript
"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePresence } from "@/hooks/use-presence";
import { getInitials } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

interface PresenceAvatarsProps {
  entityType: "task" | "project";
  entityId: string | null;
  maxVisible?: number;
  className?: string;
}

export function PresenceAvatars({
  entityType,
  entityId,
  maxVisible = 5,
  className,
}: PresenceAvatarsProps) {
  const { viewers, hasOtherViewers } = usePresence(entityType, entityId);

  // Don't render anything if user is alone
  if (!hasOtherViewers) return null;

  const visibleViewers = viewers.slice(0, maxVisible);
  const overflowCount = viewers.length - maxVisible;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1.5", className)}>
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <AvatarGroup>
            {visibleViewers.map((viewer) => (
              <Avatar key={viewer.user_id} size="sm">
                <AvatarImage src={viewer.avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(viewer.display_name, viewer.email)}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflowCount > 0 && (
              <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>
            )}
          </AvatarGroup>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex flex-col gap-0.5">
          {viewers.map((v) => (
            <span key={v.user_id} className="text-xs">
              {v.is_self ? "You" : v.display_name}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## Files to Modify

### 3. `src/components/shared/index.ts`

Add re-export:

```typescript
export { PresenceAvatars } from "./presence-avatars";
```

---

### 4. `src/app/tasks/[id]/page.tsx` — Task Detail Page

**Variable:** `taskId` (line 94: `const taskId = params.id as string;`)

**Location:** Header bar, lines 386-423. Wrap the Delete button with a flex container and add PresenceAvatars.

#### Changes

Add import (at top of file, with other shared imports around line 29-30):

```typescript
import { PresenceAvatars } from "@/components/shared";
```

Replace lines 414-422 (the standalone Delete button):

```diff
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={() => setDeleteConfirm(true)}
-            className="text-destructive hover:text-destructive"
-          >
-            <Trash2 className="h-4 w-4 mr-2" />
-            Delete
-          </Button>
+          <div className="flex items-center gap-3">
+            <PresenceAvatars entityType="task" entityId={taskId} />
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={() => setDeleteConfirm(true)}
+              className="text-destructive hover:text-destructive"
+            >
+              <Trash2 className="h-4 w-4 mr-2" />
+              Delete
+            </Button>
+          </div>
```

---

### 5. `src/app/projects/[id]/page.tsx` — Project Detail Page

**Variable:** `projectId` (line 74: `const projectId = params.id as string;`)

**Location:** Top nav bar, lines 361-382. Wrap the Delete button with a flex container and add PresenceAvatars.

#### Changes

Add import (at top of file, with other shared imports around line 30):

```typescript
import { PresenceAvatars } from "@/components/shared";
```

Replace lines 374-381 (the standalone Delete button):

```diff
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={() => setDeleteProjectConfirm(true)}
-            className="text-destructive hover:text-destructive"
-          >
-            <Trash2 className="h-4 w-4" />
-          </Button>
+          <div className="flex items-center gap-3">
+            <PresenceAvatars entityType="project" entityId={projectId} />
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={() => setDeleteProjectConfirm(true)}
+              className="text-destructive hover:text-destructive"
+            >
+              <Trash2 className="h-4 w-4" />
+            </Button>
+          </div>
```

---

### 6. `src/app/changelog/page.tsx` — Changelog Update

Add a new entry at the top of the `changelog` array (before the v0.13.2 entry at line 57).

Import `Eye` icon (add to the existing lucide-react import block at line 5):

```typescript
Eye,
```

New entry:

```typescript
{
  date: "February 11, 2026",
  version: "0.14.0",
  title: "Real-Time User Presence",
  description:
    "See who else is viewing the same task or project, with live avatar indicators in the page header.",
  features: [
    {
      icon: Eye,
      title: "User Presence Indicators",
      description:
        "When team members are viewing the same task or project page, their avatars appear in the header bar. Hover to see who's online. Avatars disappear automatically when users navigate away or become inactive.",
      tag: "new" as const,
    },
  ],
},
```

---

### 7. `src/app/wiki/page.tsx` — Wiki Update

Add a new section to the `sections` array. Import `Eye` icon (add to the existing lucide-react import block at line 5).

New section (add after the "Teams & Collaboration" section, or at the end of the array if no such section exists):

```typescript
{
  id: "presence",
  icon: Eye,
  title: "User Presence",
  description: "See who is viewing the same page in real time.",
  content: [
    {
      heading: "Real-Time Presence Indicators",
      paragraphs: [
        "When you open a task or project detail page, Ascend tracks your presence in real time. If other team members are viewing the same page, you'll see their avatars appear in the header bar next to a small eye icon.",
      ],
    },
    {
      heading: "How It Works",
      list: [
        "Avatars of active viewers appear in the top header bar of task and project detail pages.",
        "Hover over the avatar group to see a list of everyone currently viewing the page.",
        "Up to 5 avatars are shown; additional viewers appear as a \"+N\" count.",
        "If you are the only person viewing the page, no presence indicator is shown — keeping the interface clean.",
        "Presence updates automatically when users arrive, leave, or become inactive (30 seconds of inactivity).",
      ],
    },
    {
      tip: "Presence indicators help you avoid edit conflicts. If you see a teammate's avatar on the same task, consider coordinating before making changes.",
    },
  ],
},
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Same user, multiple tabs** | Deduplicated by `user_id` — keeps highest `last_active`. Appears once in avatar stack. |
| **User navigates away** | `useEffect` cleanup calls `supabase.removeChannel(channel)`. Other clients see the user disappear via `sync` event. |
| **Network disconnect** | Supabase server-side timeout removes the user (~10-30s). Client-side staleness check (30s) provides additional cleanup. On reconnect, Presence re-syncs automatically. |
| **Solo user / no team** | `hasOtherViewers === false` → component returns `null`. No visual noise. |
| **Empty entityId** | Hook returns empty viewers array. Component renders nothing. |
| **Profile loads async** | `useAuth()` sets `profile: null` initially, loads in background. Heartbeat at 15s updates `display_name` once profile is available. |
| **User signs out** | `userId` becomes null → `useEffect` cleanup fires → presence removed. |
| **50+ viewers** | Avatar stack caps at 5 + `AvatarGroupCount` showing "+N more". Tooltip lists all names. |
| **Mobile backgrounding** | Browser throttles timers → heartbeat stops → other clients' staleness check removes user after 30s. On foreground return, channel reconnects and re-tracks. |
| **Tab close without cleanup** | Supabase server-side presence timeout handles this automatically. |

---

## Existing Patterns Referenced

| File | Why it matters |
|------|----------------|
| `src/hooks/use-realtime-tasks.ts` | Primary pattern for Realtime hooks: `getClient()`, `logger`, `useEffect` guard, `removeChannel()` cleanup, dependency array conventions |
| `src/hooks/use-realtime-comments.ts` | Shows per-entity channel pattern (`task:{id}:comments`) |
| `src/hooks/use-auth.tsx` | Provides `{ user, profile }`. Profile loads async (non-blocking). |
| `src/lib/supabase/client-manager.ts` | `getClient()` singleton for Supabase client access |
| `src/lib/profile-utils.ts` | `getInitials(displayName, email)` for avatar fallbacks |
| `src/lib/logger/logger.ts` | `logger.info()`, `logger.debug()`, `logger.error()` |
| `src/components/ui/avatar.tsx` | `Avatar` (sizes: sm/default/lg), `AvatarGroup`, `AvatarGroupCount`, `AvatarImage`, `AvatarFallback` |
| `src/components/ui/tooltip.tsx` | `Tooltip`, `TooltipTrigger`, `TooltipContent` (Radix-based) |

---

## Implementation Order

1. Create `src/hooks/use-presence.ts`
2. Create `src/components/shared/presence-avatars.tsx`
3. Add re-export to `src/components/shared/index.ts`
4. Integrate into `src/app/tasks/[id]/page.tsx`
5. Integrate into `src/app/projects/[id]/page.tsx`
6. Update `src/app/changelog/page.tsx`
7. Update `src/app/wiki/page.tsx`
8. Run `npm run build` to verify no TypeScript/lint errors

---

## Verification Checklist

- [ ] **Two-tab test:** Open same task in 2 tabs as same user → widget should NOT appear (dedup = 1 viewer = self = hidden)
- [ ] **Two-user test:** Log in as 2 users, same task → both see each other's avatars, tooltip shows names
- [ ] **Leave test:** Close one user's tab → avatar disappears within ~30s
- [ ] **Navigation test:** Navigate task A → task B → no ghost presence on task A
- [ ] **Solo user test:** Open task as only user → no presence widget visible
- [ ] **Overflow test:** 6+ viewers → shows 5 avatars + "+1" count
- [ ] **Network audit:** DevTools Network tab — single WebSocket, no duplicate subscriptions, no rapid requests
- [ ] **Mobile test:** 375px width — compact avatars, tooltip accessible via tap
- [ ] **Build:** `npm run build` passes with no errors

---

## No Database Migration Required

Supabase Presence is entirely client-side — it uses the existing Realtime WebSocket infrastructure. No new tables, no RLS policies, no migrations needed. Presence state lives in Supabase's in-memory Realtime server, not in the database.

---

## After Implementation: Update Roadmap

In `docs/roadmap/PHASE_3_ROADMAP.md`, update:

```diff
- | #19 User Presence Indicators | ❌ Not started | |
+ | #19 User Presence Indicators | ✅ DONE | Supabase Realtime Presence, task + project pages, 30s staleness timeout |
```

And in the Implementation Order section:

```diff
- 5. ❌ User Presence Indicators (Item #19) - 2-3 days
+ 5. ✅ User Presence Indicators (Item #19) - 2-3 days
```

And in Definition of Done:

```diff
- - [ ] User presence shows who's viewing tasks
+ - [x] User presence shows who's viewing tasks
```
