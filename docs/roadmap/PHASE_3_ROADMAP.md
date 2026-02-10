# Phase 3: Team Collaboration - Implementation Roadmap

**Status:** In Progress (~73% complete)
**Duration:** 2-3 weeks
**Priority:** High (Market expectation, competitive differentiator)
**Last Updated:** 2026-02-10

### Implementation Progress

| Feature | Status | Notes |
|---------|--------|-------|
| #15 Real-time Task Updates | ✅ DONE | Hooks exist, tasks table now in Realtime publication |
| #16 Comments System | ✅ DONE | Full CRUD, RLS, Realtime enabled |
| #17 @Mentions & Notifications | ✅ DONE | 8 notification types (mention, task_assigned, task_unassigned, project_invited, project_lead_assigned, project_lead_removed, task_due, project_due), real-time bell, @mention UI. Due reminders via Inngest notify both the assignee/lead and the project/task creator. |
| TimePicker on Due Dates | ✅ DONE | Tasks and projects support time-of-day selection on due dates via inline TimePicker. |
| Single Task Detail Surface | ✅ DONE | Consolidated from 3 components to 1 (`/tasks/[id]` page). Removed TaskDetailsDialog, TaskEditMobile, TaskDetailsResponsive (1,749 lines deleted). |
| Inline Mobile Due Date | ✅ DONE | Due date is a collapsible inline section on mobile task detail page (not buried in properties sheet). |
| #18 Activity Feed | ✅ DONE | Database triggers (4 functions, 9 action types), RLS, Realtime, React Query hook, collapsible UI on project page |
| #19 User Presence Indicators | ❌ Not started | |
| #20 Typing Indicators | ❌ Not started (optional) | |

---

## Overview

Phase 3 transforms Ascend from a single-player project management tool into a real-time collaborative platform. Users will see live updates, comment on tasks, mention teammates, and track activity.

**Why Phase 3 before Phase 2?**
- Builds on existing Phase 1 work (avatar system, team structure, RLS policies)
- Higher user value (collaboration is a "must have" vs templates are "nice to have")
- Market expectation (Linear, Asana, ClickUp all have real-time collaboration)
- Differentiator for gaining early adopters

---

## Phase 3 Features

### 15. Real-time Task Updates
**Description:** Tasks update instantly across all clients when changed by any team member
**Why:** Foundation for collaboration - users expect instant sync in 2026
**Estimated Effort:** 3-4 days

**Technical Approach:**
- Use Supabase Realtime subscriptions on `tasks` table
- Subscribe to changes for current project/view
- Optimistically update local state, reconcile with server changes
- Handle concurrent edits gracefully (last-write-wins initially)

**Implementation Details:**
```typescript
// Subscribe to task changes for current project
const channel = supabase
  .channel(`project:${projectId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
    (payload) => {
      // Update React Query cache
      queryClient.setQueryData(['tasks', projectId], (old) => {
        // Merge payload.new into task list
      });
    }
  )
  .subscribe();
```

**Database Changes:**
- None (tasks table already exists)
- May need indexes on `project_id` for performance

**Success Criteria:**
- [ ] Task created by User A appears instantly for User B (< 1 second)
- [ ] Task status change by User A updates for User B
- [ ] Task assignment change updates for assignee immediately
- [ ] No duplicate tasks or flickering during updates
- [ ] Works with optimistic updates (no UI glitches)

**Risks:**
- Concurrent edits (two users editing same task) - mitigation: last-write-wins, show warning
- Network flakiness - mitigation: Supabase Realtime has automatic reconnection
- Performance with large projects (1000+ tasks) - mitigation: subscribe only to visible tasks

---

### 16. Comments System
**Description:** Users can comment on tasks and projects with rich text
**Why:** Core collaboration feature - discussions need context
**Estimated Effort:** 4-5 days

**Technical Approach:**
- New `comments` table with RLS policies
- Use Tiptap editor (already in use for descriptions)
- Support markdown, links, basic formatting
- Show author avatar, timestamp, "edited" indicator

**Database Schema:**
```sql
create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_has_parent check (
    (task_id is not null and project_id is null) or
    (task_id is null and project_id is not null)
  )
);

-- RLS policies
create policy "Users can view comments in their team"
  on comments for select
  using (
    exists (
      select 1 from tasks
      where tasks.id = comments.task_id
      and exists (
        select 1 from team_members
        where team_members.team_id = tasks.team_id
        and team_members.user_id = auth.uid()
      )
    )
    or exists (
      select 1 from projects
      where projects.id = comments.project_id
      and exists (
        select 1 from team_members
        where team_members.team_id = projects.team_id
        and team_members.user_id = auth.uid()
      )
    )
  );

-- Indexes for performance
create index comments_task_id_idx on comments(task_id);
create index comments_project_id_idx on comments(project_id);
create index comments_created_at_idx on comments(created_at desc);
```

**UI Components:**
- `<CommentList>` - Shows all comments for a task/project
- `<CommentItem>` - Single comment with avatar, author, timestamp, edit/delete
- `<CommentForm>` - Rich text editor for new comment
- `<CommentEditor>` - Edit existing comment inline

**Features:**
- Real-time updates (new comments appear instantly)
- Edit own comments (within 15 minutes)
- Delete own comments (soft delete or mark as "deleted")
- Reply to comments (nested threading - optional, can defer to Phase 4)
- Sort by newest/oldest

**Success Criteria:**
- [ ] User can add comment to task
- [ ] User can add comment to project
- [ ] Comments show author avatar, name, timestamp
- [ ] Comments support rich text (bold, italic, links)
- [ ] User can edit own comment (within 15 min)
- [ ] User can delete own comment
- [ ] Comments update in real-time for all viewers
- [ ] Comments are paginated (load more)
- [ ] Mobile responsive

**Risks:**
- Spam/abuse - mitigation: rate limiting on comment creation (5/min)
- Large comment threads (100+ comments) - mitigation: pagination, lazy loading
- XSS via markdown - mitigation: sanitize HTML output from Tiptap

---

### 17. @Mentions and Notifications
**Description:** Users can @mention teammates in comments to notify them
**Why:** Direct communication, ensures the right person sees the message
**Estimated Effort:** 4-5 days

**Technical Approach:**
- Extend Tiptap editor with mention extension
- Parse mentions on comment save
- Create notifications for mentioned users
- Show unread notification count in navbar
- Notification center dropdown

**Database Schema:**
```sql
create type notification_type as enum (
  'mention',
  'task_assigned',
  'task_completed',
  'comment_reply',
  'project_invite'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type notification_type not null,
  title text not null,
  message text not null,
  link text, -- URL to the relevant item
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS policies
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- Indexes
create index notifications_user_id_idx on notifications(user_id);
create index notifications_created_at_idx on notifications(created_at desc);
create index notifications_read_idx on notifications(read) where read = false;
```

**Mention Parsing:**
```typescript
// Extract @mentions from Tiptap content
function extractMentions(content: JSONContent): string[] {
  const mentions: string[] = [];
  // Recursively find all mention nodes
  traverse(content, (node) => {
    if (node.type === 'mention') {
      mentions.push(node.attrs.id); // user ID
    }
  });
  return mentions;
}

// Create notifications for mentioned users
async function notifyMentions(commentId: string, mentions: string[]) {
  for (const userId of mentions) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'mention',
      title: `${authorName} mentioned you`,
      message: `In ${taskTitle}`,
      link: `/tasks/${taskId}#comment-${commentId}`,
    });
  }
}
```

**UI Components:**
- `<MentionExtension>` - Tiptap extension for @mentions with autocomplete
- `<NotificationBell>` - Navbar icon with unread count badge
- `<NotificationCenter>` - Dropdown with notification list
- `<NotificationItem>` - Single notification with mark-as-read action

**Features:**
- Autocomplete team members when typing @ in comment
- Show notification count in navbar
- Notification center dropdown
- Mark as read (individual or bulk)
- Click notification to jump to task/comment
- Real-time notification delivery (Supabase Realtime)

**Success Criteria:**
- [ ] Typing @ in comment shows autocomplete with team members
- [ ] Selecting user inserts @mention into comment
- [ ] Mentioned user receives notification instantly
- [ ] Notification appears in navbar with count badge
- [ ] Clicking notification navigates to task/comment
- [ ] User can mark notification as read
- [ ] User can mark all as read
- [ ] Notifications are paginated (load more)
- [ ] Mobile responsive

**Additional Notification Triggers:**
- Task assigned to user
- Task marked complete (notify creator/assignee)
- Comment reply (if threading enabled)
- Project shared with user

**Risks:**
- Notification spam - mitigation: rate limiting, digest mode (hourly summary)
- Performance with many notifications (1000+) - mitigation: pagination, mark-all-as-read
- Missing notifications (Realtime disconnect) - mitigation: poll for unread count on reconnect

---

### 18. Activity Feed
**Description:** Log of all changes to tasks/projects for team visibility
**Why:** Transparency, audit trail, "what happened while I was away"
**Estimated Effort:** 3-4 days

**Technical Approach:**
- New `activity_log` table with RLS policies
- Use Supabase database triggers to auto-log changes
- Display activity feed on project page and dashboard
- Support filtering by action type, user, date range

**Database Schema:**
```sql
create type activity_action as enum (
  'task_created',
  'task_updated',
  'task_deleted',
  'task_assigned',
  'task_status_changed',
  'task_priority_changed',
  'project_created',
  'project_updated',
  'comment_added',
  'member_added',
  'member_removed'
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action activity_action not null,
  details jsonb, -- Flexible field for action-specific data
  created_at timestamptz not null default now()
);

-- RLS policies
create policy "Users can view activity in their team"
  on activity_log for select
  using (
    exists (
      select 1 from team_members
      where team_members.team_id = activity_log.team_id
      and team_members.user_id = auth.uid()
    )
  );

-- Indexes
create index activity_log_team_id_idx on activity_log(team_id);
create index activity_log_project_id_idx on activity_log(project_id);
create index activity_log_created_at_idx on activity_log(created_at desc);
create index activity_log_actor_id_idx on activity_log(actor_id);
```

**Auto-logging with Triggers:**
```sql
-- Example trigger for task status changes
create or replace function log_task_status_change()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into activity_log (team_id, project_id, task_id, actor_id, action, details)
    values (
      new.team_id,
      new.project_id,
      new.id,
      auth.uid(),
      'task_status_changed',
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'task_title', new.title
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger task_status_change_trigger
  after update on tasks
  for each row
  execute function log_task_status_change();
```

**UI Components:**
- `<ActivityFeed>` - List of activity items with infinite scroll
- `<ActivityItem>` - Single activity with icon, actor avatar, description, timestamp
- `<ActivityFilters>` - Filter by action type, user, date range

**Features:**
- Show activity feed on project page
- Show global activity feed on dashboard (all projects)
- Group related activities (e.g., "Alice updated 3 tasks")
- Real-time updates (new activities appear instantly)
- Filter by action type, user, date range
- Relative timestamps ("2 hours ago", "yesterday")

**Success Criteria:**
- [ ] Activity logged when task is created
- [ ] Activity logged when task status changes
- [ ] Activity logged when task is assigned
- [ ] Activity logged when comment is added
- [ ] Activity feed shows on project page
- [ ] Activity feed shows on dashboard
- [ ] Activities update in real-time
- [ ] User can filter by action type
- [ ] User can filter by team member
- [ ] Mobile responsive

**Risks:**
- High write volume (every change logs activity) - mitigation: indexes, partitioning if needed
- Storage growth - mitigation: archive old activities (> 6 months)
- Performance with large feeds (10k+ items) - mitigation: pagination, virtual scrolling

---

### 19. User Presence Indicators
**Description:** Show who is currently viewing a task/project
**Why:** Avoid edit conflicts, coordinate work, social proof
**Estimated Effort:** 2-3 days

**Technical Approach:**
- Use Supabase Realtime presence feature
- Track user's current location (projectId, taskId)
- Display avatars of users viewing the same item
- Show "Alice is viewing this task" tooltip

**Implementation Details:**
```typescript
// Track presence for current task
const channel = supabase.channel(`task:${taskId}`, {
  config: { presence: { key: userId } },
});

channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  const viewers = Object.values(state).flat();
  // Update UI with list of viewers
});

channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      user_id: userId,
      user_name: userName,
      avatar_url: avatarUrl,
      viewing: 'task',
      timestamp: Date.now(),
    });
  }
});

// Clean up on unmount
return () => {
  channel.unsubscribe();
};
```

**UI Components:**
- `<PresenceAvatars>` - Stack of avatar bubbles showing who's here
- `<PresenceTooltip>` - Hover to see full list of viewers

**Features:**
- Show presence on task detail page
- Show presence on project page
- Limit to 5 avatars ("+3 more" indicator)
- Show "You" badge for current user
- Fade out after 30 seconds of inactivity

**Success Criteria:**
- [ ] User A opens task, User B sees avatar appear
- [ ] User A closes task, User B sees avatar disappear
- [ ] Up to 5 avatars shown, rest in "+N more"
- [ ] Hover avatar to see name
- [ ] Presence updates in real-time (< 2 seconds)
- [ ] Mobile responsive

**Risks:**
- Too many viewers (100+ on popular task) - mitigation: show count, not all avatars
- Stale presence (user closes tab without cleanup) - mitigation: 30s timeout
- Privacy concerns - mitigation: only show to team members

---

### 20. Typing Indicators (Optional)
**Description:** Show "Alice is typing..." in comment box
**Why:** Real-time collaboration feel, reduce duplicate responses
**Estimated Effort:** 1-2 days

**Technical Approach:**
- Use Supabase Realtime presence
- Broadcast typing events when user types in comment box
- Debounce to avoid excessive updates
- Clear after 3 seconds of inactivity

**Implementation Details:**
```typescript
// Broadcast typing status
const handleTyping = debounce(() => {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      user_id: userId,
      user_name: userName,
      typing: true,
    },
  });

  // Clear after 3 seconds
  setTimeout(() => {
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, typing: false },
    });
  }, 3000);
}, 500);
```

**UI Components:**
- `<TypingIndicator>` - Shows "Alice and Bob are typing..." below comment list

**Success Criteria:**
- [ ] User A types in comment box, User B sees "Alice is typing..."
- [ ] Typing indicator clears after 3 seconds
- [ ] Multiple users shown: "Alice and 2 others are typing..."
- [ ] Indicator doesn't interfere with scrolling

**Risks:**
- Chatty (many broadcast messages) - mitigation: debounce 500ms
- Distracting - mitigation: subtle animation, dismissible

**Note:** This feature is optional and can be deferred to Phase 4 if time is limited.

---

## Implementation Order

**Week 1: Foundation**
1. ✅ Real-time Task Updates (Item #15) - 3-4 days
   - Enable Supabase Realtime
   - Subscribe to task changes
   - Update React Query cache
   - Test with multiple clients

2. ✅ Comments System (Item #16) - 4-5 days
   - Create database tables and RLS policies
   - Build comment UI components
   - Add real-time comment updates
   - Test comment CRUD operations

**Week 2: Notifications & Activity**
3. ✅ @Mentions and Notifications (Item #17) - 4-5 days
   - Add mention extension to Tiptap
   - Create notifications table and RLS
   - Build notification center UI
   - Implement real-time notification delivery
   - Add additional notification triggers

4. ✅ Activity Feed (Item #18) - 3-4 days
   - Create activity log table
   - Set up database triggers for auto-logging
   - Build activity feed UI
   - Add filtering and pagination

**Week 3: Presence & Polish**
5. ❌ User Presence Indicators (Item #19) - 2-3 days
   - Implement Supabase presence tracking
   - Build presence avatars UI
   - Test with multiple users

6. ⏳ Typing Indicators (Item #20) - 1-2 days (optional)
   - Add typing broadcast events
   - Build typing indicator UI

7. ⏳ Testing & Polish - 2-3 days
   - Manual testing of all features
   - Bug fixes
   - Performance optimization
   - Mobile testing

---

## Technical Dependencies

### Supabase Realtime Setup
- Enable Realtime on Supabase project
- Configure Realtime policies for tables
- Test connection limits (free tier: 200 concurrent)

### Database Migrations
- All schema changes via migrations
- Use Supabase migration tools
- Test migrations on dev/staging before production

### Rate Limiting
- Add rate limits to protect against spam:
  - Comments: 10/minute per user
  - Notifications: 20/minute per user
  - Activity log: No rate limit (auto-logged)

### Performance Considerations
- Index all foreign keys
- Paginate long lists (comments, activity, notifications)
- Unsubscribe from Realtime channels on unmount
- Monitor Realtime connection count

---

## Success Metrics

### User Engagement
- [ ] 80%+ of teams use comments within first week
- [ ] Average 5+ comments per task (for tasks with comments)
- [ ] 60%+ of users check notifications daily
- [ ] Activity feed viewed by 70%+ of users

### Technical Performance
- [ ] Real-time updates delivered in < 1 second
- [ ] Comment submission latency < 500ms
- [ ] Notification delivery latency < 2 seconds
- [ ] Page load time does not increase > 10%
- [ ] No memory leaks from Realtime subscriptions

### Reliability
- [ ] 99.9% uptime for Realtime connections
- [ ] Zero data loss (all comments/activity persisted)
- [ ] Graceful degradation if Realtime fails (poll fallback)

---

## Risks & Mitigations

### Risk: Supabase Realtime Limits
**Impact:** High (core feature depends on it)
**Probability:** Medium (free tier has limits)
**Mitigation:**
- Monitor concurrent connections
- Implement connection pooling
- Upgrade to paid plan if needed ($25/mo for 500 connections)

### Risk: Comment Spam/Abuse
**Impact:** Medium (degrades experience)
**Probability:** Low (internal teams, not public)
**Mitigation:**
- Rate limiting on comment creation
- Report/flag feature (Phase 4)
- Admin tools to delete comments

### Risk: Notification Fatigue
**Impact:** Medium (users ignore notifications)
**Probability:** High (common in collaboration tools)
**Mitigation:**
- Allow users to mute notifications per project
- Digest mode (hourly/daily summary)
- Smart grouping ("3 updates on Task X")

### Risk: Performance with Large Datasets
**Impact:** Medium (slow loading)
**Probability:** Medium (as data grows)
**Mitigation:**
- Pagination on all lists
- Lazy loading of comments
- Archive old activity (> 6 months)
- Database indexes optimized

### Risk: Edit Conflicts (Concurrent Editing)
**Impact:** Low (temporary confusion)
**Probability:** Medium (small teams)
**Mitigation:**
- Last-write-wins (simple, acceptable for MVP)
- Show warning if another user is editing (Phase 4: OT/CRDT)

---

## Testing Checklist

### Real-time Sync
- [ ] Task created by User A appears for User B
- [ ] Task updated by User A updates for User B
- [ ] Multiple users editing different tasks don't conflict
- [ ] Reconnect after network loss restores sync

### Comments
- [ ] Add comment to task
- [ ] Edit own comment
- [ ] Delete own comment
- [ ] Comment appears in real-time for all viewers
- [ ] Rich text formatting works (bold, italic, links)
- [ ] Comments paginate correctly

### Notifications
- [ ] @mention creates notification
- [ ] Task assignment creates notification
- [ ] Notification appears in navbar with count
- [ ] Click notification navigates to task
- [ ] Mark as read works
- [ ] Mark all as read works

### Activity Feed
- [ ] Task creation logged
- [ ] Task update logged
- [ ] Comment logged
- [ ] Activity feed shows on project page
- [ ] Activity feed shows on dashboard
- [ ] Filter by action type works
- [ ] Filter by user works

### Presence
- [ ] User A opens task, avatar appears for User B
- [ ] User A closes task, avatar disappears for User B
- [ ] Multiple users shown correctly
- [ ] Stale presence cleaned up (30s timeout)

### Mobile
- [ ] All features work on mobile (375px width)
- [ ] Notifications accessible on mobile
- [ ] Comments readable and writable on mobile
- [ ] Activity feed scrollable on mobile

---

## Documentation Needed

### User-Facing
- [ ] How to use comments
- [ ] How to @mention teammates
- [ ] How notifications work
- [ ] How to view activity feed
- [ ] Privacy: who can see what

### Developer
- [ ] Supabase Realtime setup guide
- [ ] Database schema documentation
- [ ] Rate limiting configuration
- [ ] Troubleshooting Realtime issues

### Update Changelog
- [ ] Add Phase 3 features to `src/app/changelog/page.tsx`
- [ ] Update wiki with collaboration features

---

## Post-Phase 3 Backlog

**Items deferred to Phase 4:**
- Nested comment replies (threading)
- Reaction emojis on comments/tasks
- Email notifications (digest mode)
- Advanced edit conflict resolution (OT/CRDT)
- Comment search
- @here and @channel mentions
- Notification preferences (per-project muting)
- Rich previews for links in comments

**Phase 2 items (still deferred):**
- Task dependencies
- Task templates
- Recurring tasks
- Bulk operations

---

## Definition of Done for Phase 3

Phase 3 is complete when:

### Core Features Working
- [x] Real-time task updates work across clients
- [x] Comments can be added, edited, deleted
- [x] @mentions work and send notifications
- [x] Notification center shows unread notifications
- [x] Activity feed logs all changes
- [ ] User presence shows who's viewing tasks

### Quality
- [x] All ESLint errors fixed
- [x] TypeScript errors resolved
- [x] Mobile responsive
- [x] No memory leaks (Realtime subscriptions cleaned up)
- [x] Performance acceptable (< 2s page load)

### Documentation
- [x] User guide updated in wiki
- [x] Changelog updated
- [x] Developer docs for Realtime setup
- [x] RLS policies documented

### Testing
- [x] Manual testing complete (all features)
- [x] Tested with 2-3 concurrent users
- [x] Tested on mobile devices
- [x] Tested with slow network (3G simulation)
- [x] Tested edge cases (empty states, errors)

### Security
- [x] RLS policies enforced on all new tables
- [x] Rate limiting on comments and notifications
- [x] XSS prevention in comment rendering
- [x] No secrets in client-side code

---

## Next Steps After Phase 3

Once Phase 3 is complete, we'll evaluate:

**Option A: Polish Phase 3**
- Add typing indicators
- Improve notification grouping
- Add email notifications
- Performance optimization

**Option B: Start Phase 2**
- Task dependencies
- Task templates
- Recurring tasks

**Option C: Start Phase 4 (Advanced Features)**
- Time tracking analytics
- Advanced reporting
- Integrations (Slack, GitHub)
- Custom fields

**Recommended:** Option A (polish Phase 3) → gather user feedback → then decide

---

**Created:** 2026-02-08
**Estimated Start:** After Phase 1 cleanup complete
**Estimated Completion:** 2-3 weeks from start
**Last Updated:** 2026-02-10
