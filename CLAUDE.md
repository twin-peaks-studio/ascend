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
