# MVP 0: Task Context Entries + Focus View

## Overview
Add a "Context & Findings" section to the task detail page where the user can record timestamped research notes, decisions, and findings per task. Include a dedicated "Focus" view (`/tasks/[id]/focus`) with split-pane layout (description left, context entries right) and the timer visible.

## Steps

### 1. Database migration
**File:** `supabase/migrations/20260320_task_context_entries.sql`

Create `task_context_entries` table mirroring `entity_context_entries`:
- `id UUID PK`, `task_id UUID FK → tasks(id) ON DELETE CASCADE`, `content TEXT NOT NULL`, `created_by UUID FK → profiles(id)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- Index on `(task_id, created_at DESC)`
- RLS policies: scope through `tasks.project_id → project_members.user_id = auth.uid()`

### 2. Database types
**File:** `src/types/database.ts`

Add `TaskContextEntry`, `TaskContextEntryInsert`, `TaskContextEntryUpdate` type aliases. Add `task_context_entries` table definition to the `Database` type.

### 3. React Query hook
**File:** `src/hooks/use-task-context-entries.ts` (new)

Mirror `use-entity-context-entries.ts` exactly:
- `taskContextEntryKeys` — `["task-context-entries", taskId]`
- `useTaskContextEntries(taskId)` — fetch query
- `useTaskContextEntryMutations()` — `createEntry(taskId, content)`, `updateEntry(entryId, taskId, content)`, `deleteEntry(entryId, taskId)` with optimistic cache updates

### 4. Context entry card component
**File:** `src/components/task/context-entry-card.tsx` (new)

Standalone card component (mirrors `JournalEntryCard` from entity detail page):
- View mode: `rounded-lg border bg-card p-4`, content text, dropdown menu (Edit/Delete), timestamp footer with "(edited)" indicator
- Edit mode: textarea + Cancel/Save buttons
- Props: `entry`, `onUpdate`, `onDelete`, `mutating`

### 5. Task context entries section component
**File:** `src/components/task/task-context-entries.tsx` (new)

Collapsible section component containing:
- Collapsible header: chevron + icon + "Context & Findings" + count badge + "Focus" button (opens `/tasks/[id]/focus`) + "+ Add" button
- Add entry form (textarea, Cancel/Add buttons, shown/hidden on toggle)
- Entry list using `ContextEntryCard`
- Empty state with icon + message + CTA button
- Loading skeleton

Props: `taskId`, `defaultExpanded?`

### 6. Wire into task detail page
**File:** `src/app/tasks/[id]/page.tsx`

- Import `TaskContextEntries` component
- Insert between description (line ~607) and mobile due date (line ~609):
  ```jsx
  <TaskContextEntries taskId={taskId} />
  ```
- That's it — the component is self-contained with its own hooks and state.

### 7. Focus view page
**File:** `src/app/tasks/[id]/focus/page.tsx` (new)

Full-page split-pane layout:
- **Top bar:** Back link (`← Back to Task`), task title (editable), timer button (`TimerButton` component), status/priority display
- **Left pane (50%):** Description with `MarkdownRenderer` (read-only by default, click to edit with `RichTextEditor`). Scrolls independently.
- **Right pane (50%):** `TaskContextEntries` component (always expanded, no collapse). Scrolls independently.
- **Bottom bar (optional):** Status, priority, due date at a glance — thin property strip.

Uses existing hooks: `useTask`, `useTaskMutations` for description edits. Wraps in `AppShell`. Reuses `TimerButton` from `src/components/time/timer-button.tsx`.

### 8. Pre-deployment checklist

**Changelog** (`src/app/changelog/page.tsx`): Add entry for "Context & Findings + Focus View"

**Wiki** (`src/app/wiki/page.tsx`): Add section explaining how to use context entries and the focus view

**CLAUDE.md**: Add task context entries to Technical Patterns section, document the focus view route

**Technical Guide** (`docs/TECHNICAL_GUIDE.md`): Add section on task context entries architecture
