# Project Guidelines for Claude

## Bug Reports & Clarification Protocol

**IMPORTANT:** Before starting work on any bug fix, always ask the user to clarify the following:

1. **Steps to reproduce** — Exact navigation path and actions to trigger the bug (e.g., "Go to /tasks > click task > delete > go back")
2. **Expected result** — What the user expects to happen after those steps
3. **Actual result** — What actually happens (error messages, stale data, visual glitches, etc.)
4. **Affected areas** — If the feature exists in multiple places in the app (e.g., tasks appear on both `/tasks` and `/projects/[id]/tasks`), ask explicitly: *"Does this issue occur on all pages where this feature appears, or only on a specific one?"*

Do NOT assume the scope of a bug. A bug reported on one page may also affect other pages that share the same data or components. Always confirm the full scope before writing code.

### Why This Matters
Fixing a bug in one location while missing it in another leads to multiple fix iterations, wasted time, and branches that need to be thrown away and restarted. Getting clarity upfront is always faster than iterating after the fact.

## Consistency Rules

### Task List Row Component (`TaskListItem`)
All task list surfaces in the app use `TaskListItem` from `src/components/task/task-list-view.tsx` as the single source of truth for how task rows look and behave. When modifying the visual design or behaviour of task rows, make the change **in `TaskListItem`** — not by adding a parallel custom row in each page.

Current surfaces using `TaskListItem` (all render identically):
- `/tasks` (global task page) via `TaskListView` / `SectionedTaskListView`
- `/projects/[id]` and `/projects/[id]/tasks` via `SectionedTaskListView`
- `/projects/[id]/notes/[noteId]` — uses `TaskListItem` directly

The `/today` page uses a custom `TodayTaskRow` (intentionally different — shows Reschedule and Re-estimate actions) and is **not** a candidate for `TaskListItem`.

**Design principle:** `TaskListItem` only accepts behavioural props (`onTaskClick`, `onStatusToggle`, `assignee` fallback). Never add display-toggle props (`showAssignee`, `compact`, etc.) — if data is missing, fix the query upstream instead.

### Task Editing Experience
When implementing changes to the task details dialog or task editing functionality on either the **project page** (`/projects/[id]`) or the **tasks page** (`/tasks`), always ask the user if the change should also apply to the other page. The task editing experience must be consistent across both pages.

Examples of changes that should be synchronized:
- Adding new fields to the task details dialog
- Changing how task updates are handled (optimistic updates vs refetch)
- Modifying the task card appearance or click behavior
- Adding new actions (delete, archive, duplicate, etc.)

## Technical Patterns

### Optimistic Updates
Prefer optimistic updates over refetching for a smoother user experience. Update local state immediately after a successful API call instead of calling `refetch()`.

### State Management
- Use `setProject` or `setTasks` to update local state optimistically
- Only call `refetch()` when necessary (e.g., after creating new items that need server-generated data)

### Data Fetching (React Query)
This project uses React Query (`@tanstack/react-query`) for data fetching. Key patterns:
- All data hooks use React Query for automatic request deduplication and caching
- `refetchOnWindowFocus: true` handles mobile backgrounding recovery automatically
- Query keys are defined in each hook file (e.g., `projectKeys`, `taskKeys`, `noteKeys`)
- **Prefer `setQueriesData` over `invalidateQueries`** for update/archive/flag mutations — in-place cache updates preserve list order and avoid unnecessary refetches. Only use `invalidateQueries` when fresh server-generated data is needed (e.g., after `createTask` which needs a new ID and position). See `deleteTask()` and `updateTask()` in `src/hooks/use-tasks.ts` for the canonical pattern.
- **Exception — joined relation objects:** When a mutation changes a foreign key (e.g. `assignee_id`), the in-place `setQueriesData` spread only updates the ID field, not the full joined relation object (e.g. `assignee: Profile`). In these cases, follow the `setQueriesData` call with `invalidateQueries` on the affected list caches so they refetch the full object on next mount. See `updateTask()` in `src/hooks/use-tasks.ts` for the pattern.

### Conversational AI Task Creation (Create with AI)

The "Create with AI" feature uses `usePathname()` (NOT `useParams()`) to detect the current project context from the URL. This is because `ConversationalTaskModal` is rendered inside `Sidebar`, which lives outside the page route segment tree. `usePathname()` works from anywhere in the component tree under the App Router; `useParams()` does not.

Pattern for reading route params from non-page components (sidebars, global modals, etc.):
```typescript
const pathname = usePathname();
const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
const projectId = projectMatch?.[1] ?? null;
```

Key files:
- `src/app/api/ai/chat-task-creation/route.ts` — Claude Haiku API route (30s timeout, 5 req/min rate limit, shared aiExtraction bucket)
- `src/hooks/use-conversational-task-creation.ts` — state machine hook (idle→chatting→waiting→reviewing→creating→done)
- `src/components/ai/conversational-task-modal.tsx` — full-screen dialog (85vh), rendered in sidebar

### Feedback Forms — Key Patterns & Gotchas

**Cookie path must be `/`** — The session cookie for tester authentication is scoped by name (`ascend-form-session-[slug]`) not by path. The path is set to `/` so the browser sends it to both the page (`/forms/[slug]`) and all API routes (`/api/forms/[slug]/...`). An earlier version used `path: /forms/[slug]` which prevented the cookie from being sent to API routes. Do NOT change the path back to a form-specific path.

**PostgREST FK disambiguation** — `feedback_submissions` has two FK relationships to `tasks`: one via `task_id` (submission → task) and one via `feedback_submission_id` (task → submission). Any PostgREST embedded select must specify the hint: `tasks!feedback_submissions_task_id_fkey`. Using just `tasks` causes PGRST201.

**Feedback Forms are unauthenticated routes** — Pages under `/forms/*` use a standalone layout with no Sidebar, AuthProvider, or AppShell. Do not add Supabase auth guards to these routes. Session validation is via the signed `FORM_SESSION_SECRET` cookie only.

**`FORM_SESSION_SECRET` is server-only** — This env var signs tester session cookies. It is never exposed to the client. It is required; if missing, the server throws at startup. End users of Ascend do not need to set this — it is set by the operator in `.env.local` (or production secrets). Generate with `openssl rand -base64 32`.

**Tracker `isExpanded` toggle** — The `FeedbackFormSection` expand button is a `<button>` inside a flex row that also contains the "+ Create Form" button. Clicking the chevron/text area works correctly, but if focus is trapped by a recently-closed modal, programmatic `.click()` may be needed in tests.

**Same-URL navigation is a no-op** — In the Next.js App Router, navigating via `Link` or `router.push()` to the URL you're already on does not remount the page or reset state. The "Submit another report" button was broken because it used `<Link href="/forms/[slug]">` — fixed by replacing it with an `onSubmitAnother: () => void` callback prop threaded from `page.tsx` → `FollowupChat` → `CompletionScreen`, calling `setPageState("form")` directly. Apply the same pattern anywhere you need to "restart" a form flow without leaving the page.

**Three-section task description** — Task descriptions from feedback submissions have three sections: (1) original verbatim user input, (2) AI summary, (3) additional context from Q&A. The followup API returns `{ aiSummary: string, additionalContext: Record<string,string> }` — NOT `finalContents`. Do not revert to `finalContents`.

**Tracker `task.attachments` guard** — `TrackerTask.attachments` may be `undefined` for tasks fetched before the field was added. Always access as `task.attachments ?? []` in `tracker-view.tsx`.

**File upload is server-side only** — Testers have no Supabase session, so `POST /api/forms/[slug]/submissions/[id]/upload` uses `createServiceClient()`. The `useAttachments` hook (which calls `createClient()`) cannot be used here.

**`password_plain` column** — `feedback_forms` stores plaintext password alongside `password_hash` so developers can view it in the UI. Set in `POST /api/projects/[id]/forms` and `PATCH /api/projects/[id]/forms/[formId]`.

Key files:
- `src/lib/forms/session.ts` — cookie sign/verify, `hashPassword`, `verifyPassword`
- `src/lib/forms/slug.ts` — title→slug generation with collision handling
- `src/lib/forms/adapter.ts` — `PMAdapter` interface + `AscendAdapter` (service role, bypasses RLS)
- `src/hooks/use-form-builder.ts` — form builder state machine (idle→chatting→waiting→reviewing→confirming→creating→done)
- `src/hooks/use-submission-followup.ts` — tester follow-up state machine (auto-fires on mount)
- `src/hooks/use-form-tracker.ts` — polling hook (React Query, `refetchInterval: 30_000`)
- `src/app/forms/[slug]/layout.tsx` — standalone layout (no Sidebar/AppShell)
- `src/components/forms/public/tracker-view.tsx` — standalone tracker UI (NOT reusing KanbanBoard/TaskListItem)

### Workspaces & Captures (Memory Layer MVP 1)

Workspaces (`src/contexts/workspace-context.tsx`) provide workspace isolation. Every project belongs to a workspace via `workspace_id`. The `WorkspaceProvider` wraps the app inside `AppShell` and persists the active workspace in localStorage (`active-workspace-id`).

**Workspace types:** `"standard"` (basic project container) and `"intelligence"` (unlocks Captures, daily journal, entities).

**Workspace detail page tabs:** Intelligence workspaces show tabs at `/workspaces/[id]`: Projects, Captures, Products, Entities. Standard workspaces only show the Projects grid (no tab bar). Tab components live in `src/components/workspace/workspace-*-tab.tsx`.

**Captures** are notes with `capture_type` set (not null). They live in the existing `notes` table with added columns: `workspace_id`, `capture_type`, `occurred_at`. Standard notes have `capture_type = null`. The captures hook (`use-captures.ts`) is separate from `use-notes.ts`. Captures are only accessible through the workspace detail page (Captures tab) — there is no sidebar or mobile nav link. The `/captures` route redirects to the active workspace. Capture detail links include `?workspace=[id]` for correct back-navigation. Captures have the same full editing experience as notes: Tiptap rich text editor with auto-save, linked tasks via `note_tasks` junction table, inline task creation (requires selecting a project), and AI task extraction with per-task project assignment.

**Entities** (products, initiatives, stakeholders) are managed per-workspace. The entity detail page (`/entities/[id]`) has five tabs: Overview, Journal, Links, Memory, Mentions. Journal entries (`entity_context_entries` table) are timestamped knowledge dumps that feed into the AI memory refresh alongside `foundational_context`.

**Workspace-aware navigation:** When navigating from a workspace to a project or entity, pass `?workspace=[wsId]` in the URL. The target page reads this to build the correct back link (e.g., back to `/workspaces/[wsId]` instead of `/projects`). `ProjectCard` accepts a `workspaceId` prop for this.

**Switching workspaces** calls `queryClient.clear()` to reset all React Query caches, ensuring data is refetched for the new workspace context.

Key files:
- `src/contexts/workspace-context.tsx` — `WorkspaceProvider`, `useWorkspaceContext()`
- `src/hooks/use-workspaces.ts` — workspace CRUD
- `src/hooks/use-workspace-members.ts` — member management
- `src/hooks/use-captures.ts` — capture CRUD with daily grouping
- `src/hooks/use-entities.ts` — entity CRUD with workspace scoping
- `src/hooks/use-entity-links.ts` — entity-to-entity relationships
- `src/hooks/use-entity-context-entries.ts` — journal entries CRUD
- `src/components/workspace/workspace-switcher.tsx` — dropdown in sidebar header
- `src/components/workspace/workspace-captures-tab.tsx` — captures tab content
- `src/components/workspace/workspace-products-tab.tsx` — products tab content
- `src/components/workspace/workspace-entities-tab.tsx` — entities tab content
- `src/app/captures/[id]/page.tsx` — capture detail page (mirrors note detail: rich text, tasks, AI extraction)
- `src/components/capture/` — capture-list, capture-editor

### Project Status & Sidebar Filtering

Projects have a `status` field (`"active" | "completed" | "archived"`). The sidebar (`src/components/layout/sidebar.tsx`) filters out archived projects before rendering — if you add new status values, update this filter accordingly.

**Local dev gotcha:** Archiving or completing a project fires a `"project/completed"` Inngest event to cancel due-date reminders. In local dev, Inngest isn't running, so the console will always log `ERROR: Failed to send Inngest events` with a 500. This is expected and non-fatal — the status saves correctly regardless.

### Persisted UI State (localStorage)
Task view preferences are persisted in localStorage so they survive page navigation (e.g., `/tasks` → `/tasks/[id]` → back):
- `tasks-view-mode` / `project-tasks-view-mode` — board or list layout
- `tasks-sort` / `project-tasks-sort` — sort field and direction
- `tasks-project-filter` — selected project IDs (global tasks page)
- `tasks-assignee-filter` / `project-tasks-assignee-filter` — selected assignee filter IDs
- `tasks-show-completed` / `project-tasks-show-completed` — whether completed (done) tasks are visible
- `active-workspace-id` — currently selected workspace ID (used by `WorkspaceProvider`)

When adding new filterable state to task pages, follow this pattern: initialize with a `useState` lazy initializer that reads from localStorage, and persist on every change via a `useCallback` handler.

**When you add a new localStorage key:** add it to the table above and document it in the Pre-Deployment Checklist step 3 (Technical Documentation).

## Pre-Deployment Checklist

**IMPORTANT:** Before considering any feature or bug fix complete, run through every step below. All four documentation layers are required — not optional.

### 1. Changelog (`src/app/changelog/page.tsx`)
Add a new entry to the `changelog` array (or append to the current version's `features` array):
- `date` — The release date (e.g., "March 1, 2026")
- `version` — Semantic version string (increment patch for fixes, minor for features)
- `title` — Short headline for this release
- `description` — One sentence summarizing what changed and why
- `features[]` — Each with an `icon` (Lucide), `title`, `description`, and `tag` ("new", "improved", or "fix")

### 2. User-Facing Documentation (`src/app/wiki/page.tsx`)
For any feature that introduces a new interaction or workflow visible to users:
- Add or update the relevant section in the `sections` array
- Include headings, step-by-step paragraphs, bullet lists, and tips
- Write in plain user-facing language (this is public documentation)
- Cover edge cases the user might encounter (e.g., "Search always includes completed tasks regardless of this filter")

### 3. Technical Documentation
Two files to keep up to date:

**`CLAUDE.md`** — development rules, patterns, and gotchas that apply project-wide:
- **New localStorage keys** → add to the Persisted UI State table
- **New consistency rules** → add to the Consistency Rules section
- **New dev patterns** → add to Technical Patterns
- **New local dev quirks** → document them so future sessions don't re-debug the same issues

**`docs/TECHNICAL_GUIDE.md`** — feature-specific implementation details (data flow, key files, constraints):
- **New feature with non-obvious architecture** → add a section under "Feature Architecture Notes" explaining how it works, which files own what, and any hard constraints (e.g. "do not move X to Y")

### 4. Network & Performance Audit
Before shipping, verify the feature doesn't introduce regressions:

**Network request audit:**
1. Open DevTools Network tab and navigate between pages — each navigation should make a reasonable number of requests (typically 5–15, not 100+)
2. Multiple components using the same hook should result in ONE request (React Query deduplication)
3. Watch for rapidly repeating requests — indicates a `useCallback`/`useEffect` dependency array bug

**Common pitfalls to avoid:**
```typescript
// BAD — derived state in dependency creates infinite loop
const fetchData = useCallback(() => { ... }, [data.length]);

// GOOD — stable primitive dependency
const fetchData = useCallback(() => { ... }, [userId]);
```

**Scalability check:**
- Does the query fetch only what's needed?
- Are there N+1 patterns that will degrade with more data?
- Is caching configured appropriately (`staleTime`, `gcTime`)?

**Dev server health:**
If the dev server gets stuck ("Compiling...", high CPU):
1. Check Network tab for rapid repeated requests (infinite loop)
2. Review recent `useCallback`/`useEffect` dependency arrays
3. Look for state-changes-trigger-fetch-trigger-state-change loops
