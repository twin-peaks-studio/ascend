# Entity Memory Implementation Plan

> **Status:** Planning
> **Created:** March 12, 2026
> **Context:** Evolves MVP 2 (Entities + Brain Dump) from MEMORY_LAYER.md with new Product → Initiative hierarchy and @mention-driven memory system.

---

## Overview

This plan replaces the original MVP 2 spec with a richer model based on product management workflows. The key evolution:

**Original MVP 2:** Generic entities + brain dump extraction
**New MVP 2:** Products, Initiatives, Stakeholders as entity types + @mention-driven memory + AI-synthesized entity memory with manual refresh

### Core Concepts

1. **Products** — Things you ship/manage (Online Ordering, Mobile App, POS)
2. **Initiatives** — Cross-product work efforts (current "projects" become these)
3. **Stakeholders** — People/groups you work with (VP, Engineering Team, Legal)
4. **@Mentions** — Inline entity linking in any text surface (`@OnlineOrdering`)
5. **Foundational Context** — User-written description that teaches AI what an entity is
6. **AI Memory** — AI-synthesized knowledge per entity, refreshed on demand
7. **Entity Mentions** — Index of where entities are referenced across all content

### Data Flow

```
User writes content with @mentions
        ↓
On save: parse @mentions → create entity_mentions records
        ↓
User clicks "Refresh Memory" on entity page
        ↓
AI reads foundational_context + all mentioned source content
        ↓
AI extracts ONLY relevant portions → synthesizes entity memory
        ↓
Stored in entities.ai_memory
```

---

## Phase 1: Database Schema + Migration Tooling (Migrate First, Build Later)

The guiding principle: **migrate existing data before building new features.** All new tables are additive. Existing pages are unaffected. The migration UI lets you reorganize your current projects into the new Product → Initiative model before any app-level changes.

### 1A. Database Migration

**New tables:**

```sql
-- Products, initiatives, stakeholders, and any future entity types
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'initiative', 'stakeholder')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- for @mention matching (lowercase, no spaces)
  description TEXT, -- short tagline
  foundational_context TEXT, -- detailed user-written knowledge (teaches AI what this entity is)
  ai_memory TEXT, -- AI-synthesized knowledge (updated on manual refresh)
  memory_refreshed_at TIMESTAMPTZ, -- when AI memory was last refreshed
  metadata JSONB DEFAULT '{}', -- flexible per-type data
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

-- Many-to-many: initiatives ↔ products (cross-product initiatives)
CREATE TABLE entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN (
    'initiative_product',    -- initiative belongs to product
    'stakeholder_product',   -- stakeholder associated with product
    'stakeholder_initiative' -- stakeholder associated with initiative
  )),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_entity_id, target_entity_id, link_type)
);

-- Index of where entities are @mentioned across all content
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'note', 'comment', 'task_description', 'capture'
  )),
  source_id UUID NOT NULL, -- polymorphic FK to note/comment/task/capture
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, source_type, source_id)
);

-- Bridge: existing projects → entity system
-- Each project gets an optional entity_id linking it into the entity graph
ALTER TABLE projects ADD COLUMN entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;

-- Bridge: tasks can optionally link to an initiative entity
-- (keeps existing project_id for backward compat)
ALTER TABLE tasks ADD COLUMN initiative_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_entities_workspace ON entities(workspace_id);
CREATE INDEX idx_entities_type ON entities(workspace_id, entity_type);
CREATE INDEX idx_entities_slug ON entities(workspace_id, slug);
CREATE INDEX idx_entity_links_source ON entity_links(source_entity_id);
CREATE INDEX idx_entity_links_target ON entity_links(target_entity_id);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_entity_mentions_source ON entity_mentions(source_type, source_id);

-- RLS: workspace members can access entities in their workspace
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view entities"
  ON entities FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert entities"
  ON entities FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update entities"
  ON entities FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can delete entities"
  ON entities FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- entity_links: accessible if user can access the source entity's workspace
CREATE POLICY "workspace members can manage entity links"
  ON entity_links FOR ALL
  USING (source_entity_id IN (
    SELECT id FROM entities WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));

-- entity_mentions: accessible if user can access the entity's workspace
CREATE POLICY "workspace members can manage entity mentions"
  ON entity_mentions FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
```

### 1B. TypeScript Types

**File:** `src/types/database.ts` — add:

```typescript
export type EntityType = 'product' | 'initiative' | 'stakeholder';

export interface Entity {
  id: string;
  workspace_id: string;
  entity_type: EntityType;
  name: string;
  slug: string;
  description: string | null;
  foundational_context: string | null;
  ai_memory: string | null;
  memory_refreshed_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type EntityLinkType =
  | 'initiative_product'
  | 'stakeholder_product'
  | 'stakeholder_initiative';

export interface EntityLink {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  link_type: EntityLinkType;
  created_at: string;
}

export type MentionSourceType = 'note' | 'comment' | 'task_description' | 'capture';

export interface EntityMention {
  id: string;
  entity_id: string;
  workspace_id: string;
  source_type: MentionSourceType;
  source_id: string;
  created_at: string;
}
```

### 1C. Data Hooks (Minimal — Just Enough for Migration)

**File:** `src/hooks/use-entities.ts`

```
useEntities(workspaceId, entityType?) — list entities, optionally filtered by type
useEntity(entityId) — single entity with linked entities
useEntityMutations() — create, update, delete entities
  - createEntity(input) — auto-generates slug from name
  - updateEntity(id, input) — updates entity, regenerates slug if name changes
  - deleteEntity(id) — deletes entity + cascading links/mentions
```

**File:** `src/hooks/use-entity-links.ts`

```
useEntityLinks(entityId) — all links for an entity (both directions)
useEntityLinkMutations() — create/delete links between entities
```

### 1D. Migration Tooling UI

**File:** `src/app/settings/migrate/page.tsx`

A temporary admin page (accessible from Settings) with three steps:

**Step 1: Create Products**
- Simple form: name + description + foundational context
- List of created products with edit/delete
- Pre-populated suggestions based on existing project names

**Step 2: Convert Projects → Initiatives**
- Shows all existing projects in a list
- For each project: multi-select dropdown to pick which product(s) it maps to
- "Convert" button per project:
  1. Creates an entity (type: "initiative") for the project
  2. Sets `projects.entity_id` to the new entity
  3. Creates `entity_links` (initiative_product) for each selected product
- Bulk "Convert All" with default 1:1 product mapping

**Step 3: Verify**
- Shows Products → Initiatives → Task counts
- Highlights any orphaned projects (not yet converted)
- "Migration complete" confirmation when all projects are linked

### 1E. What This Does NOT Change

- Existing pages still read from `projects` table
- Sidebar still shows projects
- Task views unchanged
- Zero UI regressions — migration only backfills new columns

---

## Phase 2: Entity CRUD + Workspace UX

Once data is migrated, expose entities in the UI and restructure how content lives within workspaces. Entities and products are accessed via workspace tabs (at `/workspaces/[id]`), not standalone routes or sidebar links.

### 2A. Workspace Information Architecture

**Key decision: captures/notes live at the workspace level, not inside projects.**

A meeting note might reference 3 products and 2 initiatives. Forcing it under one project is artificial. Captures float at the workspace level and connect to products/initiatives via @mentions.

**The workspace hierarchy:**
```
Workspace (your whole work context)
  ├── Captures (workspace-wide notes, daily journal — not nested under projects)
  ├── Products (things you ship)
  ├── Initiatives/Projects (efforts that span products)
  └── Tasks (live under initiatives, but can tag products)
```

**Access pattern:** Products and Entities are accessed via workspace tabs at `/workspaces/[id]` (Products tab, Entities tab). There are no standalone routes or sidebar links for these. The sidebar continues to show Today, Captures, and Tasks. Everything is scoped to the active workspace. Switching workspaces shows only that workspace's data.

### 2B. Entity Detail Page

**`/entities/[id]`** — Entity detail page with tabs:
- **Overview**: Name, description, foundational context (editable)
- **Memory**: AI-synthesized memory + "Refresh Memory" button + last refreshed timestamp (empty until Phase 4)
- **Mentions**: All content that references this entity (empty until Phase 3)
- **Links**: Connected products/initiatives/stakeholders with task rollup
- **Journal**: Timestamped knowledge entries (brain dumps, decisions, context)
- **For Products**: The Links tab shows linked initiatives with a progress bar and task count breakdown (todo/in-progress/done)
- **For Initiatives**: The Links tab shows linked products, plus a Tasks section listing all active tasks from the initiative's project(s) with status icons and a progress bar

**Task rollup hooks:** `useInitiativeTaskRollup(entityId)` and `useProductTaskRollup(entityId, linkedInitiativeIds)` in `src/hooks/use-entity-task-rollup.ts`. These fetch tasks via the chain: entity → project (via `entity_id`) → tasks. Cached with React Query (30s staleTime).

### 2C. Product Label on All Task Views

All task view surfaces must display the associated **product** as a visible label/badge on each task row. This gives users immediate context about which product a task relates to, without opening the task or checking the project.

**Affected surfaces:**
- `/tasks` (global task page) — `TaskListItem` in `task-list-view.tsx`
- `/projects/[id]` and `/projects/[id]/tasks` — `TaskListItem` via `SectionedTaskListView`
- `/projects/[id]/notes/[noteId]` — `TaskListItem` directly
- `/today` — `TodayTaskRow` (custom row, separate from `TaskListItem`)
- Board views (Kanban cards) — both global and project-scoped

**Data flow:** Tasks → Projects → Products (via `project_products` / entity links). The product is derived from the task's project, not stored directly on the task.

**Implementation notes:**
- `TaskListItem` receives `Task | TaskWithProject`. The `TaskWithProject` type includes `project: Projects | null`. The product relationship must be resolved from the project — this likely requires extending the query to join through to products/entities, or loading products at the list level and passing them down.
- `TodayTaskRow` is intentionally separate from `TaskListItem` — it needs the same product label but via its own implementation.
- Follow the existing design rule: do NOT add display-toggle props to `TaskListItem`. If a surface needs product data, fix the query upstream so the data is always available.
- A task's project may link to multiple products. Decide on UX: show first product only, show all as pills, or show a "+2 more" overflow.

### 2D. Product Linkage in Project Properties Panel

After migration, users need a day-to-day way to manage which product(s) a project/initiative is linked to — without going back to the migration tool.

**Location:** Add a "Products" section to the existing `PropertiesPanel` (`src/components/project/properties-panel.tsx`), which is already a sidebar on the project detail page (`/projects/[id]`). This is the simplest path — no new routes needed.

**UI:** Multi-select pill picker (same pattern as the migration page). Shows currently linked products as removable pills, with a combobox to add more.

**Capabilities:**
- View which product(s) a project/initiative is linked to
- Remove an `initiative_product` link (unlink from a product)
- Add a new link to a different product
- Link to multiple products simultaneously (initiatives can span products)

**Why PropertiesPanel, not a new settings page:** `PropertiesPanel` already exists as a collapsible sidebar on the project page. Adding a section there keeps product management in context alongside other project metadata (status, dates, members). If the panel grows too crowded later, we can extract to a dedicated `/projects/[id]/settings` route.

**Files to modify:**
- `src/components/project/properties-panel.tsx` — add Products section with multi-select pills

---

## Phase 3: @Mention System (All Text Surfaces)

### 3A. Mention Autocomplete Component

**File:** `src/components/shared/mention-autocomplete.tsx`

A reusable autocomplete dropdown that:
- Triggers on `@` character (after space/newline or at line start)
- Queries entities in current workspace by slug/name prefix
- Shows entity type icon + name + type badge
- Keyboard nav: ↑↓ to navigate, Enter/Tab to insert, Esc to dismiss
- Inserts `@EntityName` into text with a trailing space

This needs to integrate with **three different editor types:**

1. **Tiptap (RichTextEditor)** — notes, task descriptions
   - Create a Tiptap extension (`@tiptap/extension-mention` pattern)
   - Stores mention as custom node: `<span data-entity-id="uuid" data-entity-slug="slug">@Name</span>`
   - On save: extract entity IDs from mention nodes

2. **Plain textarea (comments, captures)** — comments, capture editor
   - Reuse pattern from existing `comment-form.tsx` mention system
   - Extend to query entities (not just project members)
   - Store as text: `@EntityName` with separate mention tracking

3. **Markdown editor (project descriptions)** — project form
   - Same textarea approach as comments

### 3B. Mention Parsing & Persistence

**On every save** (note update, comment create, task description update, capture save):

1. Parse content for `@mentions` (from Tiptap nodes or text regex)
2. Resolve entity IDs from slugs
3. Diff against existing `entity_mentions` for this source
4. Insert new mentions, delete removed mentions

**Pattern:** Create a `useMentionSync(sourceType, sourceId)` hook that handles this diff logic. Call it from each save handler.

**File:** `src/hooks/use-entity-mentions.ts`

```
useEntityMentions(entityId) — all mentions of an entity with source content
useMentionParser() — parses @mentions from text, returns entity IDs
useSaveMentions(sourceType, sourceId) — saves parsed mentions to DB
```

### 3C. Files to Modify

| File | Change |
|------|--------|
| `src/components/shared/rich-text-editor.tsx` | Add Tiptap mention extension, entity autocomplete |
| `src/components/comments/comment-form.tsx` | Extend existing @mention to include entities |
| `src/components/capture/capture-editor.tsx` | Add @mention support to textarea |
| `src/components/shared/markdown-editor.tsx` | Add @mention support |
| `src/components/shared/markdown-renderer.tsx` | Render @mentions as styled pills/links |
| `src/hooks/use-notes.ts` | Call mention sync on note save |
| `src/hooks/use-captures.ts` | Call mention sync on capture save |
| `src/components/comments/comment-item.tsx` | Call mention sync on comment create |
| `src/components/task/task-form.tsx` | Call mention sync on description save |

---

## Phase 4: AI Memory Refresh

### 4A. API Route

**File:** `src/app/api/ai/entity-memory/route.ts`

```
POST /api/ai/entity-memory
Body: { entityId: string }
Auth: Supabase session (must be workspace member)
Rate limit: 5 req/min (new bucket: aiEntityMemory)
Model: Claude Sonnet 4.6 (needs reasoning to extract relevant portions)
Timeout: 60 seconds
```

**Pipeline:**
1. Fetch entity (foundational_context, current ai_memory)
2. Fetch all entity_mentions → resolve source content (notes, comments, tasks, captures)
3. Build prompt:
   ```
   You are analyzing content for the entity "{name}" ({entity_type}).

   FOUNDATIONAL CONTEXT (what this entity is):
   {foundational_context}

   CURRENT MEMORY (previous synthesis, may be empty):
   {ai_memory}

   SOURCES (content that mentions this entity):
   [Source 1: Note "Weekly COMO Meeting" - Mar 12]
   {full note content}

   [Source 2: Task comment on "Research Apple Pay"]
   {full comment content}

   ...

   INSTRUCTIONS:
   - Extract ONLY the portions of each source that are relevant to this entity
   - Ignore content about other topics even if in the same document
   - Synthesize into a structured summary: key findings, decisions, open questions, action items
   - Preserve important details (names, dates, specific technical facts)
   - Note which source each piece of information came from
   - If previous memory exists, merge new information (don't lose old knowledge unless contradicted)
   ```
4. Save response to `entities.ai_memory` + update `memory_refreshed_at`
5. Return updated memory

### 4B. Entity Page Integration

On the entity detail page (`/entities/[id]`), the Memory tab shows:
- Current AI memory (rendered as markdown)
- "Refresh Memory" button
- "Last refreshed: 3 days ago" timestamp
- Badge: "12 new mentions since last refresh"
- Loading state during refresh with progress indicator

---

## Phase 5: Portfolio View (New UI Reading From Entity Model)

> **Note:** This phase is future work. Documenting the vision so the data model supports it.

**Portfolio via workspace tabs:** The Products tab at `/workspaces/[id]` serves as the portfolio view:
- Card per product: name, initiative count, task rollup, capture count
- Click into product → see linked initiatives with progress

**Initiative pages (`/projects/[id]`):**
- Product linkage managed via `PropertiesPanel` (see Phase 2D) — already available post-migration
- Add "Linked Stakeholders" section
- Everything else stays the same (tasks, notes, kanban, etc.)

---

## Phase 6: Teams & Sharing Verification

> **Note:** This is a validation phase, not a feature build. Run through these checks before considering the entity system production-ready.

### 6A. RLS Policy Verification

Verify that all entity-related RLS policies work correctly for shared workspaces:
- Workspace members can CRUD entities in their workspace
- Workspace members can view/manage entity_links for entities in their workspace
- Workspace members can view/manage entity_mentions in their workspace
- Non-members cannot access any entity data from other workspaces
- Users in multiple workspaces see only the correct entities per workspace

### 6B. Product Linkage Access Control

Verify that product linkage management in `PropertiesPanel` respects team boundaries:
- All project members can view linked products
- Members with appropriate roles can add/remove product links
- Product links created by one member are visible to all project members
- Switching workspaces clears product linkage data from cache (`queryClient.clear()`)

### 6C. Shared Entity Editing

Verify concurrent and multi-user entity management:
- Multiple team members can edit the same entity's foundational context
- Entity memory refresh results are visible to all workspace members
- @mentions resolve correctly for all workspace members (not just the creator)
- Deleting an entity cascades correctly (links, mentions) for all users

### 6D. Cross-Workspace Isolation

Verify that workspace isolation is airtight:
- Entity slugs are unique per workspace (same slug allowed in different workspaces)
- @mention autocomplete only shows entities from the active workspace
- AI memory refresh only pulls mentions from the current workspace
- Product linkage pills only show products from the current workspace

---

## Implementation Order

```
Phase 1: DATABASE + MIGRATION (migrate first, build later)
  1A: SQL migration (entities, entity_links, entity_mentions tables + bridge columns)
  1B: TypeScript types
  1C: Data hooks (use-entities, use-entity-links — minimal for migration)
  1D: Migration tooling UI (/settings/migrate)
  1E: Verify migration — no regressions, data is clean
    ↓
Phase 2: ENTITY CRUD + WORKSPACE UX (view what you migrated)
  2A: Workspace information architecture (captures at workspace level, not project level) ✅
  2B: Entity detail page (/entities/[id]) with tabs + task rollup ✅
  2C: Product label on all task views (TaskListItem, TodayTaskRow, Kanban cards) ✅
  2D: Product linkage in PropertiesPanel (manage product links day-to-day) ✅
    ↓
Phase 3: #MENTION SYSTEM (inline entity linking in Tiptap editors) ✅ (MVP — Tiptap only)
  3A: Mention autocomplete component ✅
  3B: Tiptap mention extension (notes, captures, task descriptions) ✅
  3C: Textarea mention support (comments) — DEFERRED (comments keep @user mentions only for now)
  3D: Mention parsing & persistence (useMentionSync) ✅
  3E: Mention rendering in read-only views — ✅ (CSS styles in globals.css, rendered via dangerouslySetInnerHTML)
    ↓
Phase 4: AI MEMORY REFRESH (entity intelligence)
  4A: AI memory refresh API route
  4B: Entity page Memory tab with refresh button
    ↓
Phase 5: PORTFOLIO VIEW (future — data model supports it from Phase 1)
    ↓
Phase 6: TEAMS & SHARING VERIFICATION (validate before production)
  6A: RLS policy verification (workspace member access)
  6B: Product linkage access control (PropertiesPanel respects roles)
  6C: Shared entity editing (concurrent multi-user scenarios)
  6D: Cross-workspace isolation (slugs, mentions, products scoped correctly)
```

---

## Key Design Decisions

### Why `entities` table instead of separate `products`/`stakeholders` tables?

Single table = uniform @mention system. The autocomplete queries one table. Mentions link to one table. AI memory works the same for any entity type. Adding new types (e.g., "system", "team", "competitor") is just a new `entity_type` value, no schema change.

### Why keep `projects` table instead of migrating to `entities`?

Projects have deep integration throughout the app (tasks, notes, sections, comments, activity log, RLS policies, sidebar). Replacing `projects` with entities would be a massive refactor with high regression risk. Instead, bridge via `projects.entity_id` — projects reference their entity counterpart, existing code is unaffected.

### Why manual memory refresh instead of automatic?

1. Avoids burning AI calls on every save
2. User controls when half-formed thoughts crystallize into memory
3. Predictable costs (user-initiated, not event-driven)
4. Can show "X new mentions since last refresh" as a prompt

### Why one `entity_mentions` table instead of separate junction tables?

The original plan had `entity_projects`, `entity_tasks`, `entity_notes`. But @mentions can come from any text surface (comments too), and the mention source might expand (chat messages in MVP 4). A single polymorphic `entity_mentions` table with `source_type` + `source_id` is simpler and extensible.

### Why do captures live at the workspace level, not inside projects?

A meeting note often references multiple products and initiatives. Nesting it under one project forces an artificial choice. Workspace-level captures connect to any number of entities via @mentions — the note floats freely, and its relationships are explicit. This also means the captures page shows your full daily journal across all your work, not fragmented per project.

### Why slugs for @mention matching?

Users type `@OnlineOrdering` not `@4f43b086-cdfd...`. Slugs (lowercase, no spaces: "onlineordering" or "online-ordering") enable fast prefix matching in the autocomplete and reliable parsing from saved text.

---

## Files Created (New)

| File | Phase | Purpose |
|------|-------|---------|
| `supabase/migrations/YYYYMMDD_entities.sql` | 1A | Database migration |
| `src/hooks/use-entities.ts` | 1C | Entity CRUD hook |
| `src/hooks/use-entity-links.ts` | 1C | Entity relationship hook |
| `src/app/settings/migrate/page.tsx` | 1D | Migration tooling page |
| `src/components/entity/entity-detail.tsx` | 2B | Entity detail page component |
| `src/components/entity/entity-form.tsx` | 2B | Create/edit entity form |
| `src/components/entity/entity-links-panel.tsx` | 2B | Linked entities panel |
| `src/app/entities/[id]/page.tsx` | 2B | Entity detail page |
| `src/lib/utils/enrich-task-products.ts` | 2C | Shared utility to enrich tasks with product data from entity links |
| `src/hooks/use-project-products.ts` | 2C | Hook to fetch products for a project's entity_id (used by project pages) |
| `src/hooks/use-entity-task-rollup.ts` | 2B | Task rollup hooks for entity detail page (initiative + product) |
| `src/hooks/use-entity-mentions.ts` | 3D | Mention tracking hook |
| `src/components/shared/mention-autocomplete.tsx` | 3A | Reusable @mention dropdown |
| `src/components/entity/entity-memory.tsx` | 4B | AI memory display + refresh |
| `src/components/entity/entity-mentions-list.tsx` | 4B | List of all mentions |
| `src/app/api/ai/entity-memory/route.ts` | 4A | AI memory refresh endpoint |

## Files Modified (Existing)

| File | Change |
|------|--------|
| `src/types/database.ts` | Add Entity, EntityLink, EntityMention types |
| `src/components/shared/rich-text-editor.tsx` | Add Tiptap @mention extension |
| `src/components/shared/markdown-editor.tsx` | Add @mention autocomplete |
| `src/components/shared/markdown-renderer.tsx` | Render @mention pills |
| `src/components/comments/comment-form.tsx` | Extend @mention to include entities |
| `src/components/capture/capture-editor.tsx` | Add @mention support |
| `src/components/project/properties-panel.tsx` | Add Products section with multi-select pill picker for product linkage |
| `src/types/index.ts` | Add `TaskProduct` interface and `products` field to `TaskWithProject` |
| `src/hooks/use-tasks.ts` | Enrich tasks with products in `fetchTasksForUser` |
| `src/hooks/use-notes.ts` | Enrich note-linked tasks with products; call mention sync on save |
| `src/hooks/use-captures.ts` | Enrich capture-linked tasks with products; call mention sync on save |
| `src/components/task/task-list-view.tsx` | Render product badge in `TaskListItem` meta row |
| `src/components/task/task-card.tsx` | Render product badge in `TaskCard` footer (Kanban) |
| `src/app/today/page.tsx` | Render product badge in `TodayTaskRow` badges row |
| `src/app/projects/[id]/page.tsx` | Pass `projectProducts` to task useMemo |
| `src/app/projects/[id]/tasks/page.tsx` | Pass `projectProducts` to task useMemo |
| `src/lib/rate-limit/limiter.ts` | Add aiEntityMemory bucket |
| `CLAUDE.md` | Document new patterns, localStorage keys |
| `docs/TECHNICAL_GUIDE.md` | Document entity architecture |
| `docs/initiatives/MEMORY_LAYER.md` | Update MVP 2 status |

---

## Relationship to MEMORY_LAYER.md MVPs

| Original MVP | New Status |
|-------------|-----------|
| MVP 1 (Workspaces + Captures) | ✅ Complete (pending SQL migration) — unchanged |
| MVP 2 (Entities + Brain Dump) | **Replaced by this plan** (Phases 1-4). Brain dump deferred to after @mention system is working. |
| MVP 3 (Embeddings + Search) | Unchanged — builds on entity_mentions for richer embedding |
| MVP 4 (Chat + Task Creation) | Unchanged — entity memory becomes additional RAG context |
| MVP 5 (Oracle) | Unchanged — can detect entity knowledge gaps |

### Brain Dump: Deferred, Not Removed

The brain dump feature from original MVP 2 is deferred to after Phase 3 (AI Memory) is working. Rationale: the @mention + manual refresh flow is the primary way to build entity memory. Brain dump is a power-user shortcut for bootstrapping — it's more valuable once the entity system is live and can receive the extracted data.

When implemented, brain dump will use the same `entities` table and `foundational_context` field. The extraction pipeline writes to the same structures.
