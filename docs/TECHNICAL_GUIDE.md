# Ascend Technical Documentation

A comprehensive technical guide for developers working on the Ascend application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Supabase Integration](#supabase-integration)
6. [Type System](#type-system)
7. [Data Validation](#data-validation)
8. [Security Implementation](#security-implementation)
9. [Custom Hooks](#custom-hooks)
10. [Component Architecture](#component-architecture)
11. [Calendar Date Picker](#calendar-date-picker)
12. [Drag and Drop](#drag-and-drop)
13. [Styling System](#styling-system)
14. [State Management](#state-management)
15. [Error Handling](#error-handling)
16. [Performance Considerations](#performance-considerations)
17. [Testing Guidelines](#testing-guidelines)
18. [Deployment](#deployment)
19. [Contributing](#contributing)

---

## Architecture Overview

Ascend follows a modern React architecture with Next.js App Router:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │  Components │  │    Custom Hooks     │  │
│  │  (App Router)│  │  (React)    │  │  (Data Fetching)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────────────┐   │
│  │              Supabase Client (Browser)                 │   │
│  │         @supabase/ssr - createBrowserClient           │   │
│  └───────────────────────┬───────────────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase Backend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  PostgreSQL │  │     RLS     │  │    Realtime         │   │
│  │  Database   │  │  Policies   │  │   (Future)          │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Project-Centric Model** - Projects are first-class citizens; tasks belong to projects
2. **Multiple Tasks Per Project** - Projects can contain many related tasks
3. **Security First** - Input sanitization, XSS prevention, CSP headers
4. **Type Safety** - Full TypeScript coverage with Zod runtime validation
5. **Optimistic UI** - Immediate UI updates with background sync

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.6 | React framework with App Router |
| **React** | 19.x | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **shadcn/ui** | Latest | Pre-built UI components |
| **@dnd-kit** | 6.x | Drag and drop |
| **Supabase** | 2.x | Backend as a Service |
| **React Query** | 5.x | Data fetching, caching, and synchronization |
| **Zod** | 3.x | Runtime validation |
| **Lucide React** | Latest | Icons |
| **vaul** | Latest | Mobile drawer component |
| **react-markdown** | 10.x | Markdown rendering |
| **remark-gfm** | 4.x | GitHub Flavored Markdown support |

### Why These Choices?

- **Next.js App Router** - Server components, streaming, better performance
- **Supabase over Firebase** - PostgreSQL, better RLS, open source
- **@dnd-kit over react-beautiful-dnd** - Active maintenance, better mobile support, smaller bundle
- **Zod over Yup** - Better TypeScript inference, more composable
- **shadcn/ui** - Customizable, accessible, not a dependency (code is copied)
- **React Query** - Request deduplication, automatic caching, built-in refetchOnWindowFocus for mobile backgrounding

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Dashboard (/)
│   ├── globals.css              # Global styles + Tailwind
│   ├── tasks/
│   │   └── page.tsx             # Kanban board (/tasks)
│   └── projects/
│       ├── page.tsx             # Projects list (/projects)
│       └── [id]/
│           ├── page.tsx         # Project detail (/projects/[id])
│           └── notes/
│               ├── create/
│               │   └── page.tsx # Create note (/projects/[id]/notes/create)
│               └── [noteId]/
│                   └── page.tsx # Note detail (/projects/[id]/notes/[noteId])
│
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── drawer.tsx           # Mobile bottom drawer (vaul)
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── sheet.tsx            # Bottom/side sheet for mobile
│   │   └── tabs.tsx
│   │
│   ├── layout/                  # App shell components
│   │   ├── app-shell.tsx        # Main wrapper with sidebar
│   │   ├── sidebar.tsx          # Navigation sidebar (collapsible)
│   │   ├── mobile-bottom-nav.tsx # Mobile/tablet floating navigation
│   │   └── header.tsx           # Page header with theme toggle
│   │
│   ├── board/                   # Kanban board components
│   │   ├── kanban-board.tsx     # Main board with DnD context
│   │   ├── kanban-column.tsx    # Individual column
│   │   └── column-header.tsx    # Column title + count
│   │
│   ├── task/                    # Task-related components
│   │   ├── task-card.tsx        # Draggable task card
│   │   ├── task-form.tsx        # Create/edit task form
│   │   └── task-dialog.tsx      # Task quick create/edit modal
│   │
│   ├── project/                 # Project-related components
│   │   ├── project-card.tsx     # Project card for list view (links to detail page)
│   │   ├── project-form.tsx     # Create project form
│   │   ├── project-dialog.tsx   # Create project modal
│   │   └── properties-panel.tsx # Reusable properties sidebar component
│   │
│   ├── note/                    # Note-related components
│   │   ├── index.ts             # Barrel exports
│   │   ├── note-list-item.tsx   # Note card for project page list
│   │   └── quick-add-note-task.tsx # Inline task creation from note
│   │
│   ├── shortcuts-dialog.tsx     # Keyboard shortcuts modal
│   │
│   └── shared/                  # Shared/reusable components
│       ├── index.ts             # Barrel exports
│       ├── file-upload.tsx      # File upload component
│       ├── attachments-list.tsx # Attachments display
│       ├── markdown-editor.tsx  # Rich text editor with toolbar
│       └── markdown-renderer.tsx # Markdown display component
│
├── hooks/                       # Custom React hooks
│   ├── use-projects.ts          # Project CRUD operations (React Query)
│   ├── use-tasks.ts             # Task CRUD operations (React Query)
│   ├── use-documents.ts         # Document CRUD operations (React Query)
│   ├── use-notes.ts             # Note CRUD operations + task linking (React Query)
│   ├── use-profiles.ts          # User profile data (React Query, team-scoped)
│   ├── use-project-members.ts   # Project membership management (React Query)
│   ├── use-auth.tsx             # Authentication state and actions
│   ├── use-recovery.ts          # App recovery state for mobile backgrounding
│   ├── use-keyboard-shortcuts.ts # Global keyboard shortcuts
│   ├── use-media-query.ts       # Responsive breakpoint detection
│   └── use-sidebar.tsx          # Sidebar collapse state context
│
├── lib/
│   ├── utils.ts                 # Utility functions (cn, etc.)
│   ├── validation.ts            # Zod schemas
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   ├── client-manager.ts    # Singleton client with health checking
│   │   └── server.ts            # Server Supabase client
│   ├── utils/
│   │   └── with-timeout.ts      # Request timeout utilities
│   └── security/
│       └── sanitize.ts          # Input sanitization
│
├── providers/
│   ├── query-provider.tsx       # React Query provider with global config
│   └── app-recovery-provider.tsx # Mobile backgrounding recovery
│
└── types/
    ├── index.ts                 # Application types
    └── database.ts              # Supabase generated types
```

### File Naming Conventions

- **Components**: `kebab-case.tsx` (e.g., `task-card.tsx`)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-tasks.ts`)
- **Types**: `kebab-case.ts` or `PascalCase` for type names
- **Pages**: `page.tsx` (Next.js App Router convention)

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│      projects       │       │       tasks         │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │──┐    │ id (PK, UUID)       │
│ title (TEXT)        │  │    │ project_id (FK,UUID)│◄──┐
│ description (TEXT)  │  │    │ title (TEXT)        │   │
│ status (TEXT)       │  │    │ description (TEXT)  │   │
│ color (TEXT)        │  └───►│ status (TEXT)       │   │
│ created_at (TSTZ)   │   1:N │ priority (TEXT)     │   │
│ updated_at (TSTZ)   │       │ is_duplicate (BOOL) │   │
└─────────────────────┘       │ is_archived (BOOL)  │   │
         │                    │ position (INT)      │   │
         │                    │ created_at (TSTZ)   │   │
         │                    │ updated_at (TSTZ)   │   │
         │                    └─────────────────────┘   │
         │                            │                 │
         │                            └─────────────────┘
         │
         │            ┌─────────────────────────┐
         │            │   project_documents     │
         │            ├─────────────────────────┤
         └───────────►│ id (PK, UUID)           │
                      │ project_id (FK, UUID)   │
                      │ title (TEXT)            │
                      │ url (TEXT)              │
                      │ content (TEXT)          │
                      │ type (TEXT)             │
                      │ created_at (TSTZ)       │
                      └─────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│       notes         │       │     note_tasks      │       │       tasks         │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │◄──────│ note_id (FK, UUID)  │       │ id (PK, UUID)       │
│ project_id (FK,UUID)│       │ task_id (FK, UUID)  │──────►│ (see above)         │
│ title (TEXT)        │       │ created_at (TSTZ)   │       └─────────────────────┘
│ content (TEXT)      │       │ UNIQUE(note_id,     │
│ created_by (FK,UUID)│       │        task_id)     │
│ created_at (TSTZ)   │       └─────────────────────┘
│ updated_at (TSTZ)   │
└─────────────────────┘
```

### Table Definitions

#### projects

```sql
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `title` | TEXT | NOT NULL | Project name |
| `description` | TEXT | nullable | Detailed description |
| `status` | TEXT | CHECK constraint | active, completed, archived |
| `color` | TEXT | default #3b82f6 | Hex color code |
| `created_at` | TIMESTAMPTZ | auto | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | auto | Last update timestamp |

#### tasks

```sql
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_duplicate BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** Multiple tasks can belong to the same project (one-to-many relationship).

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `project_id` | UUID | FK, nullable | Parent project (optional) |
| `title` | TEXT | NOT NULL | Task name |
| `description` | TEXT | nullable | Task details |
| `status` | TEXT | CHECK | todo, in-progress, done |
| `priority` | TEXT | CHECK | low, medium, high, urgent |
| `is_duplicate` | BOOLEAN | default false | Duplicate flag |
| `is_archived` | BOOLEAN | default false | Soft delete flag |
| `position` | INTEGER | default 0 | Sort order in column |

#### project_documents

```sql
CREATE TABLE project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  content TEXT,
  type TEXT DEFAULT 'link' CHECK (type IN ('link', 'document', 'note')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### notes

```sql
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `project_id` | UUID | FK, NOT NULL | Parent project |
| `title` | TEXT | NOT NULL | Note title |
| `content` | TEXT | nullable | Rich text content (markdown) |
| `created_by` | UUID | FK, NOT NULL | User who created the note |
| `created_at` | TIMESTAMPTZ | auto | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | auto | Last update timestamp |

#### note_tasks (Junction Table)

```sql
CREATE TABLE note_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, task_id)
);
```

**Purpose:** Many-to-many relationship between notes and tasks. When a task is created from a note, a record is inserted here to link them.

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `note_id` | UUID | FK, NOT NULL | Parent note |
| `task_id` | UUID | FK, NOT NULL | Linked task |
| `created_at` | TIMESTAMPTZ | auto | When the link was created |

**Cascade Behavior:**
- Deleting a note removes all `note_tasks` records (tasks remain)
- Deleting a task removes all `note_tasks` records (notes remain)

### Row Level Security (RLS)

Currently configured for open access (no authentication):

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Open policies (replace when adding auth)
CREATE POLICY "Allow all" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all" ON project_documents FOR ALL USING (true);
```

**Future Auth Implementation:**

```sql
-- Example: User-based policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Notifications Table (Phase 3)

```
┌─────────────────────────┐
│     notifications       │
├─────────────────────────┤
│ id (PK, UUID)           │
│ user_id (FK → profiles) │  ← Recipient
│ actor_id (FK → profiles)│  ← Who triggered it
│ type (TEXT)              │  ← mention, task_assigned, task_unassigned,
│                         │     project_invited, project_lead_assigned,
│                         │     project_lead_removed
│ comment_id (FK, NULL)   │
│ task_id (FK, NULL)      │
│ project_id (FK, NULL)   │
│ read (BOOL, default F)  │
│ created_at (TSTZ)       │
└─────────────────────────┘
```

**RLS Policies:**
- SELECT: `user_id = auth.uid()` (users see only their own notifications)
- INSERT: `auth.uid() IS NOT NULL` (any authenticated user can create, app validates context)
- UPDATE: `user_id = auth.uid()` (users can mark their own as read)
- DELETE: `user_id = auth.uid()` (users can delete their own)

**Realtime:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`

**Indexes:** `user_id`, `created_at DESC`, partial index on `(user_id, read) WHERE read = false`

---

## Supabase Integration

### Client Setup

#### Browser Client (`src/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
```

#### Server Client (`src/lib/supabase/server.ts`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

### Query Patterns

#### Fetching with Relationships

```typescript
// Fetch projects with their tasks (one-to-many)
const { data, error } = await supabase
  .from("projects")
  .select(`
    *,
    tasks:tasks(*)
  `)
  .order("updated_at", { ascending: false });
```

#### Insert with Return

```typescript
const { data, error } = await supabase
  .from("projects")
  .insert({ title, description, color })
  .select()
  .single();
```

#### Update with Optimistic UI

```typescript
// Update locally first
setTasks(prev => prev.map(t =>
  t.id === id ? { ...t, status: newStatus } : t
));

// Then sync to database
const { error } = await supabase
  .from("tasks")
  .update({ status: newStatus, updated_at: new Date().toISOString() })
  .eq("id", id);

// Rollback on error
if (error) {
  setTasks(previousTasks);
}
```

### Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note:** These are public keys safe for browser exposure. The anon key has limited permissions controlled by RLS policies.

---

## Type System

### Core Types (`src/types/index.ts`)

```typescript
// Project types
export type ProjectStatus = "active" | "completed" | "archived";

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithRelations extends Project {
  tasks: Task[];
  documents: ProjectDocument[];
}

// Task types
export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_duplicate: boolean;
  is_archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWithProject extends Task {
  project: Project;
}

// Document types
export type DocumentType = "link" | "document" | "note";

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  url: string | null;
  content: string | null;
  type: DocumentType;
  created_at: string;
}

// Note types
export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NoteWithProject extends Note {
  project: Project | null;
}

export interface NoteWithRelations extends Note {
  project: Project | null;
  tasks: Task[];  // Tasks linked via note_tasks junction table
}
```

### Database Types (`src/types/database.ts`)

Generated from Supabase schema. Regenerate with:

```bash
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

### Type Safety Patterns

```typescript
// Discriminated union for form modes
type FormMode =
  | { mode: "create" }
  | { mode: "edit"; initialData: Project };

// Generic hook return type
interface UseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

---

## Data Validation

### Zod Schemas (`src/lib/validation.ts`)

#### Safe String Helpers

```typescript
/**
 * Safe required string with sanitization and length limits
 */
const safeRequiredString = (maxLength: number = 500) =>
  z
    .string()
    .min(1, "This field is required")
    .max(maxLength, `Must be ${maxLength} characters or less`)
    .transform((val) => sanitizeString(val));

/**
 * Safe optional string with sanitization
 */
const safeOptionalString = (maxLength: number = 2000) =>
  z
    .string()
    .max(maxLength, `Must be ${maxLength} characters or less`)
    .transform((val) => sanitizeString(val))
    .nullable()
    .optional();
```

#### Project Schemas

```typescript
export const createProjectSchema = z.object({
  title: safeRequiredString(100),
  description: safeOptionalString(2000),
  status: projectStatusSchema.default("active"),
  color: projectColorSchema,
});

export const updateProjectSchema = z.object({
  title: safeRequiredString(100).optional(),
  description: safeOptionalString(2000),
  status: projectStatusSchema.optional(),
  color: projectColorSchema.optional(),
});
```

#### Task Schemas

```typescript
export const createTaskSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  title: safeRequiredString(200),
  description: safeOptionalString(5000),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  position: z.number().int().min(0).default(0),
});
```

#### Note Schemas

```typescript
export const createNoteSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  title: safeRequiredString(200),
  content: safeOptionalString(50000),  // Allow longer content for rich notes
});

export const updateNoteSchema = z.object({
  title: safeRequiredString(200).optional(),
  content: safeOptionalString(50000),
});
```

#### Validation Usage

```typescript
// In a form submission handler
const handleSubmit = async (formData: unknown) => {
  const result = createProjectSchema.safeParse(formData);

  if (!result.success) {
    // Handle validation errors
    const errors = result.error.flatten();
    setFieldErrors(errors.fieldErrors);
    return;
  }

  // Data is validated and sanitized
  const validData = result.data;
  await createProject(validData);
};
```

---

## Security Implementation

### Input Sanitization (`src/lib/security/sanitize.ts`)

```typescript
/**
 * Sanitize a string to prevent XSS attacks
 * - Escapes HTML special characters
 * - Removes script tags and event handlers
 * - Trims whitespace
 */
export function sanitizeString(input: string): string {
  if (!input) return "";

  return input
    // Trim whitespace
    .trim()
    // Remove null bytes
    .replace(/\0/g, "")
    // Escape HTML special characters
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Remove potential script injections
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "");
}

/**
 * Sanitize and validate a URL
 * - Only allows http and https protocols
 * - Blocks javascript: protocol
 */
export function sanitizeUrl(input: string): string {
  if (!input) return "";

  const trimmed = input.trim();

  // Block dangerous protocols
  const dangerousProtocols = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
  ];

  for (const pattern of dangerousProtocols) {
    if (pattern.test(trimmed)) {
      return "";
    }
  }

  // Only allow http and https
  if (!/^https?:\/\//i.test(trimmed)) {
    // Assume https if no protocol
    return `https://${trimmed}`;
  }

  return trimmed;
}
```

### Content Security Policy

Configured in `next.config.ts`:

```typescript
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];
```

### Security Best Practices

1. **Never use `dangerouslySetInnerHTML`** - All content is auto-escaped by React
2. **Validate URLs before rendering** - Use `sanitizeUrl()` for any user-provided URLs
3. **Parameterized queries** - Supabase client handles SQL injection prevention
4. **Input length limits** - All fields have maximum lengths to prevent DoS
5. **HTTPS only** - URLs are validated to only allow secure protocols

---

## Custom Hooks

All data hooks use **React Query** (`@tanstack/react-query`) for:
- **Request deduplication** - Multiple components using the same hook = 1 network request
- **Automatic caching** - Data is cached and served from cache when fresh
- **Background refetching** - `refetchOnWindowFocus: true` automatically refreshes data when returning from mobile backgrounding
- **Optimistic updates** - UI updates immediately, syncs to database in background

### Query Provider Configuration (`src/providers/query-provider.tsx`)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // Data fresh for 30 seconds
      gcTime: 5 * 60 * 1000,       // Keep in cache for 5 minutes
      retry: 1,                     // Single retry on failure
      refetchOnWindowFocus: true,   // Refetch when tab becomes visible
      refetchOnMount: true,         // Refetch when component mounts
    },
  },
});
```

### Query Key Pattern

Each hook defines query keys for cache management:

```typescript
// Example from use-projects.ts
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (userId: string) => [...projectKeys.lists(), userId] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};
```

### useProjects (`src/hooks/use-projects.ts`)

```typescript
export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: projectKeys.list(user?.id ?? ""),
    queryFn: () => fetchProjectsForUser(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    projects,
    setProjects: (updater) => {
      queryClient.setQueryData(projectKeys.list(user?.id ?? ""), updater);
    },
    loading: isLoading,
    error,
    refetch,
  };
}

// Mutations invalidate relevant queries
const createProject = async (input) => {
  const result = await supabase.from("projects").insert(data).select().single();
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
  return result;
};
```

### useTasks (`src/hooks/use-tasks.ts`)

```typescript
interface UseTasksReturn {
  tasks: TaskWithProject[];
  loading: boolean;
  error: Error | null;
  createTask: (data: CreateTaskInput) => Promise<Task | null>;
  updateTask: (id: string, data: UpdateTaskInput) => Promise<Task | null>;
  updateTaskPosition: (id: string, status: TaskStatus, position: number) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}
```

### useNotes (`src/hooks/use-notes.ts`)

Three hooks for note management:

```typescript
// Fetch notes for a project (used in project page)
function useProjectNotes(projectId: string | null): {
  notes: Note[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Fetch single note with linked tasks (used in note detail page)
function useNote(noteId: string | null): {
  note: NoteWithRelations | null;
  setNote: Dispatch<SetStateAction<NoteWithRelations | null>>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Note mutations
function useNoteMutations(): {
  createNote: (input: CreateNoteInput) => Promise<Note | null>;
  updateNote: (noteId: string, input: UpdateNoteInput) => Promise<Note | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
  createTaskFromNote: (noteId: string, projectId: string, taskData: { title: string; description?: string }) => Promise<Task | null>;
  linkTaskToNote: (noteId: string, taskId: string) => Promise<boolean>;
  unlinkTaskFromNote: (noteId: string, taskId: string) => Promise<boolean>;
  loading: boolean;
}
```

**Key Implementation Details:**

```typescript
// createTaskFromNote creates a task AND links it to the note
const createTaskFromNote = async (noteId, projectId, taskData) => {
  // 1. Create task with project_id
  const task = await supabase.from("tasks").insert({
    project_id: projectId,
    title: taskData.title,
    status: "todo",
    priority: "medium",
    // ...
  });

  // 2. Link task to note via junction table
  await supabase.from("note_tasks").insert({
    note_id: noteId,
    task_id: task.id,
  });

  return task;
};
```

### useNotifications (`src/hooks/use-notifications.ts`)

```typescript
// Query keys
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string) => [...notificationKeys.all, "list", userId] as const,
  unreadCount: (userId: string) => [...notificationKeys.all, "unread-count", userId] as const,
};

// Hooks
export function useNotifications(userId: string | null);       // Fetch notifications list
export function useUnreadNotificationCount(userId: string | null); // Fetch unread count
export function useNotificationMutations(userId: string | null);   // markAsRead, markAllAsRead
```

### useRealtimeNotifications (`src/hooks/use-realtime-notifications.ts`)

Subscribes to Supabase Realtime `postgres_changes` on the `notifications` table filtered by `user_id=eq.{userId}`. On INSERT events, invalidates the notification list and unread count queries so the bell badge updates instantly.

### Notification Helper (`src/lib/notifications/create-notification.ts`)

Centralized utility for creating notification rows. All notification types go through this module:

```typescript
notifyMention(params)              // @mention in a comment
notifyTaskAssigned(params)         // Task assigned to user
notifyTaskUnassigned(params)       // Task unassigned from user
notifyProjectInvited(params)       // User invited to project
notifyProjectLeadAssigned(params)  // User made project lead
notifyProjectLeadRemoved(params)   // User removed as project lead
```

Each function inserts a row into `notifications` and suppresses self-notifications (won't notify you for your own actions).

### Inngest — Durable Workflow Engine

Inngest powers time-based notifications (task due reminders). It schedules a function to wake up at a future time and automatically cancels it when the task is completed, deleted, or the due date changes.

**Files:**

```
src/inngest/client.ts                       — Inngest client singleton
src/inngest/events.ts                       — Typed event definitions
src/inngest/functions/task-due-reminder.ts  — The due date reminder function
src/app/api/inngest/route.ts               — Inngest serve handler (GET/POST/PUT)
src/app/api/inngest/events/route.ts        — Authenticated event proxy for client-side hooks
src/lib/inngest/send-events.ts             — Client-side utility to send events via proxy
src/lib/supabase/service.ts                — Service role client (bypasses RLS for Inngest functions)
```

**Events:**

| Event | Purpose |
|-------|---------|
| `task/due-date.set` | Trigger: schedules reminder for 1hr before due |
| `task/due-date.updated` | Cancel: cancels sleeping reminder when due date changes |
| `task/due-date.removed` | Cancel: cancels when due date is cleared |
| `task/completed` | Cancel: cancels when task status → done |
| `task/deleted` | Cancel: cancels when task is deleted |

**Flow:**

1. Hook fires event via `sendInngestEvents()` → POST `/api/inngest/events`
2. Event proxy authenticates user and forwards to Inngest
3. Inngest function sleeps until `dueDate - 1 hour`
4. On wake: inserts `task_due` notification row via service role client
5. Realtime subscription delivers notification to user's bell

**Environment Variables:**

- `INNGEST_EVENT_KEY` — for sending events (production)
- `INNGEST_SIGNING_KEY` — for verifying webhook authenticity (production)
- `SUPABASE_SERVICE_ROLE_KEY` — for the service client used in Inngest functions

### useKeyboardShortcuts (`src/hooks/use-keyboard-shortcuts.ts`)

```typescript
interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  callback: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrlKey || shortcut.metaKey;
        const matchesModifier = ctrlOrMeta
          ? (e.ctrlKey || e.metaKey)
          : true;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && matchesModifier) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
```

### useMediaQuery (`src/hooks/use-media-query.ts`)

Hook for responsive breakpoint detection using `useSyncExternalStore` for proper SSR compatibility:

```typescript
import { useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getServerSnapshot(): boolean {
  return false; // Prevents hydration mismatch
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    getServerSnapshot
  );
}

// Convenience hook for mobile detection
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
```

**Usage:**
```typescript
const isMobile = useIsMobile();

// Render different components based on screen size
if (isMobile) {
  return <MobileDrawer />;
}
return <DesktopDialog />;
```

---

## Component Architecture

### Component Composition Pattern

```
AppShell
├── Sidebar
│   └── NavLinks
├── Header
│   ├── Title
│   ├── QuickCreateButton
│   └── ThemeToggle
└── Main Content (children)
    └── Page-specific components
```

### Props Pattern

```typescript
// Base props with common attributes
interface BaseCardProps {
  className?: string;
  children: React.ReactNode;
}

// Extended props for specific use
interface TaskCardProps extends BaseCardProps {
  task: TaskWithProject;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}
```

### Form Components

Forms follow a consistent pattern:

```typescript
interface TaskFormProps {
  mode: "create" | "edit";
  initialData?: Task;
  projectId?: string;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onCancel: () => void;
}

export function TaskForm({ mode, initialData, projectId, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    // ...
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const schema = mode === "create" ? createTaskSchema : updateTaskSchema;
    const result = schema.safeParse(formData);

    if (!result.success) {
      // Handle validation errors
      return;
    }

    await onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Task Detail Page

All task viewing/editing is done on the `/tasks/[id]` page (`src/app/tasks/[id]/page.tsx`). There is a single surface for task details — clicking a task anywhere in the app navigates to this page via `router.push(`/tasks/${taskId}`)`.

**Layout (Desktop):**
- Two-panel layout: scrollable content area + collapsible 300px properties sidebar
- Left panel: Title with checkbox, description, attachments, time tracking, comments
- Right sidebar: Project, assignee, due date (with TimePicker), priority, status, timer

**Layout (Mobile):**
- Full-width content area with floating properties button (bottom-left)
- Properties shown in a bottom Sheet when the button is tapped
- Same fields as desktop, adapted for touch

### Responsive Layout Architecture

The app uses a responsive breakpoint system with three tiers:

**Breakpoints:**
- **Mobile**: < 768px (`md` breakpoint)
- **Tablet**: 768px - 1023px (`md` to `lg`)
- **Desktop**: ≥ 1024px (`lg` breakpoint)

**Navigation Pattern:**
```
Desktop (lg+)          Tablet/Mobile (<lg)
┌──────┬─────────┐    ┌─────────────────┐
│      │         │    │                 │
│ Side │  Main   │    │     Main        │
│ bar  │ Content │    │    Content      │
│      │         │    │                 │
│      │         │    ├─────────────────┤
│      │         │    │ [Dash][Tasks][+]│ ← Floating nav
└──────┴─────────┘    └─────────────────┘
```

**Sidebar State Management (`src/hooks/use-sidebar.tsx`):**
```typescript
interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

// Provider wraps app in layout.tsx
<SidebarProvider>
  {children}
</SidebarProvider>

// Usage in components
const { isCollapsed, toggleSidebar } = useSidebar();
```

**Mobile Bottom Navigation (`src/components/layout/mobile-bottom-nav.tsx`):**
- Floating pill-shaped navigation bar
- Visible on mobile and tablet (below `lg` breakpoint)
- Contains: Dashboard, Tasks, Projects links
- Separate Search button and floating Add (+) button

**Sidebar Collapse (`src/components/layout/sidebar.tsx`):**
- Desktop only (`lg:flex`)
- Toggles between 256px (expanded) and 64px (collapsed)
- Collapsed shows icons only with tooltips
- Collapse button at bottom of sidebar

### Project Detail Page

The `/projects/[id]` page uses a **Linear-style two-column layout** with inline editing:

**Layout:**
- Navigation bar with breadcrumb and delete button
- Flex layout with collapsible right panel
- Left panel: Project icon, title, description, tasks section (collapsible), resources
- Right panel: Properties sidebar (collapsible on desktop/tablet, sheet on mobile)

**Properties Panel (`src/components/project/properties-panel.tsx`):**
Reusable component for project properties, used in both:
- Desktop/Tablet: Inline sidebar panel (280px, collapsible)
- Mobile: Bottom sheet (80vh height)

```typescript
<PropertiesPanel
  project={project}
  profiles={profiles}
  membersCount={members.length}
  projectMutationLoading={projectMutationLoading}
  onStatusChange={handleStatusChange}
  onLeadChange={handleLeadChange}
  onDueDateChange={handleDueDateChange}
  onPriorityChange={handlePriorityChange}
  onColorChange={handleColorChange}
  onShowMembers={() => setShowMembersDialog(true)}
/>
```

**Mobile Properties Access:**
- Floating settings button (bottom-left, `md:hidden`)
- Opens Sheet component sliding up from bottom
- Same PropertiesPanel component rendered inside

```typescript
{/* Mobile properties floating button */}
<button
  onClick={() => setShowMobileProperties(true)}
  className="fixed bottom-28 left-4 z-50 ... md:hidden"
>
  <Settings2 className="h-5 w-5" />
</button>

{/* Mobile properties sheet */}
<Sheet open={showMobileProperties} onOpenChange={setShowMobileProperties}>
  <SheetContent side="bottom" className="h-[80vh]">
    <PropertiesPanel {...props} />
  </SheetContent>
</Sheet>
```

**Tasks Section:**
- Collapsible section, collapsed by default when tasks exist
- Shows task count in header: "Tasks (3)"
- Task cards are clickable buttons that navigate to `/tasks/[id]`
- Optimistic updates: changes reflect immediately without page refresh

**State Management Pattern:**
Uses render-time state initialization instead of useEffect to avoid lint warnings:

```typescript
// Track if project data has loaded and update local state
const [hasInitializedFromProject, setHasInitializedFromProject] = useState(false);
if (project && !hasInitializedFromProject) {
  setHasInitializedFromProject(true);
  setTitle(project.title);
  setDescription(project.description ?? "");
}
```

**Update Handlers (No Refetch):**
```typescript
// Handle title save - no refetch() needed
const handleTitleSave = useCallback(async () => {
  const trimmedTitle = title.trim();
  if (trimmedTitle && trimmedTitle !== project?.title) {
    await updateProject(projectId, { title: trimmedTitle });
    // Don't call refetch() - local state is already correct
  }
  setIsEditingTitle(false);
}, [title, project?.title, projectId, updateProject]);

// Handle task update from details dialog - optimistic update
const handleTaskDetailsUpdate = useCallback(
  async (data: UpdateTaskInput) => {
    if (!selectedTask || !project) return;
    const result = await updateTask(selectedTask.id, data);
    if (result) {
      // Update selectedTask so dialog shows correct values
      setSelectedTask((prev) => prev ? { ...prev, ...data } : null);
      // Optimistically update project's tasks list (no refetch)
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === selectedTask.id ? { ...t, ...data } : t
          ),
        };
      });
    }
  },
  [selectedTask, project, updateTask, setProject]
);
```

### Markdown Editor Component

The `MarkdownEditor` component (`src/components/shared/markdown-editor.tsx`) provides Word-like rich text editing for descriptions.

**Features:**
- Formatting toolbar with buttons for Bold, Italic, Lists, Indent/Outdent, and Links
- Keyboard shortcuts (Cmd/Ctrl+B, Cmd/Ctrl+I, Cmd/Ctrl+K)
- Auto-list continuation when pressing Enter
- Smart list termination (Enter on empty item exits list)
- Tab/Shift+Tab for indentation (desktop)
- Touch-friendly toolbar buttons for mobile
- Stores content as Markdown strings (no database changes needed)

**Props Interface:**
```typescript
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}
```

**Usage:**
```typescript
import { MarkdownEditor } from "@/components/shared";

<MarkdownEditor
  value={description}
  onChange={setDescription}
  placeholder="Add a description..."
  rows={4}
  maxLength={5000}
/>
```

**List Auto-Detection:**
- Typing `- `, `* `, or `+ ` at line start begins a bullet list
- Typing `1. ` at line start begins a numbered list
- Enter key continues the list with appropriate marker
- Enter on empty list item removes marker and exits list mode

### Markdown Renderer Component

The `MarkdownRenderer` component (`src/components/shared/markdown-renderer.tsx`) displays Markdown content as formatted HTML.

**Features:**
- Uses `react-markdown` with `remark-gfm` for GitHub Flavored Markdown
- Custom component styling for consistent appearance
- Safe rendering (no raw HTML allowed)
- Links open in new tab with `rel="noopener noreferrer"`
- Handles null/empty content gracefully

**Props Interface:**
```typescript
interface MarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
  placeholder?: string;
}
```

**Usage:**
```typescript
import { MarkdownRenderer } from "@/components/shared";

// Display mode
<MarkdownRenderer content={task.description} />

// With custom placeholder
<MarkdownRenderer
  content={description}
  placeholder="No description provided"
  className="text-foreground"
/>
```

**Supported Markdown:**
- **Bold**: `**text**` or `__text__`
- **Italic**: `*text*` or `_text_`
- **Bullet lists**: `- item` or `* item`
- **Numbered lists**: `1. item`
- **Links**: `[text](url)`
- **Code**: `` `inline code` ``
- **Code blocks**: Triple backticks

---

## Calendar Date Picker

The calendar date picker (`src/components/ui/calendar.tsx`) is a **delicate component** that requires special attention when modifying. It uses `react-day-picker` with custom scrolling behavior to provide a smooth, mobile-friendly date selection experience.

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  Scroll Container (max-h-[200px])       │
│  - overflow-y-scroll                     │
│  - touch-action: pan-y                   │
│  - WebkitOverflowScrolling: touch        │
│  ┌─────────────────────────────────────┐ │
│  │  DayPicker (12 months)              │ │
│  │  - 6 months before current          │ │
│  │  - Current month (scroll target)    │ │
│  │  - 5 months after current           │ │
│  │  - hideNavigation (scroll instead)  │ │
│  │  - showOutsideDays (continuous)     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Key Design Decisions

1. **Vertical Scrolling Instead of Navigation Arrows**
   - Renders 12 months in a single scrollable column
   - Auto-scrolls to current month on mount (50% scroll position)
   - More intuitive for touch devices
   - No need for "previous/next" buttons

2. **Continuous Week Display**
   - `showOutsideDays={true}` ensures weeks display continuously across month boundaries
   - When a month ends mid-week, days from the next month fill in the remaining cells
   - Critical for maintaining correct day-of-week alignment

3. **Touch-Optimized Scrolling**
   - `touch-action: pan-y` on container enables vertical touch scrolling
   - `touch-pan-y` class on day buttons allows scroll gestures to pass through
   - Touch event handlers stop propagation to prevent popover interference

### Critical Implementation Details

#### Scroll Container Setup
```typescript
<div
  ref={scrollRef}
  onWheel={handleWheel}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  className="max-h-[200px] overflow-y-scroll overscroll-contain"
  style={{
    WebkitOverflowScrolling: 'touch',  // Smooth momentum scrolling on iOS
    touchAction: 'pan-y',               // Enable vertical touch scrolling
    scrollbarWidth: 'thin',             // Subtle scrollbar
  }}
>
```

#### Auto-Scroll to Current Month
```typescript
React.useEffect(() => {
  if (scrollRef.current) {
    const scrollHeight = scrollRef.current.scrollHeight;
    const clientHeight = scrollRef.current.clientHeight;
    // Current month is at ~50% since we have 6 months before and 5 after
    scrollRef.current.scrollTop = (scrollHeight - clientHeight) / 2;
  }
}, []);
```

#### Touch Event Handlers
```typescript
// Prevent parent popover from intercepting touch events
const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
  e.stopPropagation();
}, []);

const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
  e.stopPropagation();
}, []);
```

#### Day Button Touch Action
```typescript
day_button: cn(
  buttonVariants({ variant: "ghost" }),
  "h-7 w-7 p-0 font-normal text-sm aria-selected:opacity-100 touch-pan-y"
  //                                                         ^^^^^^^^^^^
  // CRITICAL: Allows vertical scroll gestures to pass through buttons
),
```

### Sizing Reference

Current element sizes (for ~20% larger than default shadcn):

| Element | Size | Tailwind Class |
|---------|------|----------------|
| Container height | 200px | `max-h-[200px]` |
| Day buttons | 28x28px | `h-7 w-7` |
| Day text | 14px | `text-sm` |
| Weekday width | 28px | `w-7` |
| Weekday text | 12px | `text-xs` |
| Month caption | 14px | `text-sm` |
| Padding | 12px | `p-3` |

Visible rows: ~5-6 weeks (varies by month structure)

### Common Pitfalls (DO NOT)

1. **DO NOT remove `showOutsideDays`**
   - Weeks will have gaps when months end mid-week
   - Day-of-week alignment will be broken

2. **DO NOT change to single-month with navigation arrows**
   - Loses the smooth scrolling UX
   - Requires additional state management for month navigation
   - Less intuitive on mobile

3. **DO NOT remove touch event handlers**
   - Touch scrolling will stop working in popovers/dialogs
   - Parent components may intercept touch events

4. **DO NOT remove `touch-pan-y` from day buttons**
   - Touch scrolling will only work between buttons, not on them
   - Users will struggle to scroll on mobile

5. **DO NOT set `touch-action: none` on any child element**
   - Breaks touch scrolling entirely

### Testing Checklist

When modifying the calendar, verify:

- [ ] Desktop: Mouse wheel scrolling works smoothly
- [ ] Desktop: Clicking dates selects them correctly
- [ ] Mobile: Vertical finger swipe scrolls the calendar
- [ ] Mobile: Tapping dates selects them (not just scrolls)
- [ ] Popover: Calendar scrolls independently of page
- [ ] Month transition: Days display continuously across month boundaries
- [ ] Initial load: Calendar auto-scrolls to show current month
- [ ] Selected date: Previously selected date shows highlighted when re-opening

### Usage Locations

The Calendar component is used in:
- Task creation dialog (due date field)
- Task edit dialog (due date field)
- Task details dialog (due date field)
- Project creation dialog (due date field)
- Project detail page (due date field)
- Mobile task edit drawer (due date field)

All locations use the `DatePicker` wrapper (`src/components/ui/date-picker.tsx`) which wraps Calendar in a Popover.

### Related Files

- `src/components/ui/calendar.tsx` - Core calendar component
- `src/components/ui/date-picker.tsx` - Popover wrapper for calendar
- `src/components/ui/popover.tsx` - Popover primitive (may affect touch behavior)

---

## Drag and Drop

### @dnd-kit Implementation

#### Board Structure (`src/components/board/kanban-board.tsx`)

```typescript
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function KanbanBoard() {
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // Update task status
    await updateTaskPosition(taskId, newStatus, 0);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {columns.map(column => (
          <KanbanColumn key={column} status={column} tasks={tasksByColumn[column]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
```

#### Droppable Column (`src/components/board/kanban-column.tsx`)

```typescript
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[300px] rounded-lg p-4",
        isOver && "ring-2 ring-primary"
      )}
    >
      <ColumnHeader status={status} count={tasks.length} />
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
```

#### Sortable Task Card

```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableTaskCard({ task }: { task: TaskWithProject }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}
```

---

## Styling System

### Tailwind Configuration

The project uses Tailwind CSS v4 with CSS variables for theming:

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
}

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  /* ... */
}
```

### cn Utility Function

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage:
```typescript
<div className={cn(
  "base-styles",
  isActive && "active-styles",
  className // Allow override from props
)} />
```

### shadcn/ui Components

Components are copied (not installed as dependencies) to `src/components/ui/`. This allows full customization.

To add new components:
```bash
npx shadcn@latest add [component-name]
```

---

## State Management

### React Query for Server State

Server state (data from Supabase) is managed by **React Query**:

```typescript
// Data hooks use React Query for server state
const { data: projects, isLoading } = useQuery({
  queryKey: projectKeys.list(userId),
  queryFn: () => fetchProjects(userId),
});

// Mutations with cache invalidation
const createProject = async (input) => {
  const result = await supabase.from("projects").insert(data);
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
  return result;
};
```

### Local State for UI

Component-level UI state uses React's built-in state:

```typescript
// Component-level state for UI
const [isOpen, setIsOpen] = useState(false);
const [isEditingTitle, setIsEditingTitle] = useState(false);
```

### Optimistic Updates

For immediate UI feedback, update React Query cache directly:

```typescript
// Optimistic update pattern
const handleUpdate = async (data) => {
  // Update cache immediately (optimistic)
  queryClient.setQueryData(projectKeys.detail(id), (old) => ({
    ...old,
    ...data,
  }));

  // Sync to database
  await supabase.from("projects").update(data).eq("id", id);
  // No need to refetch - cache is already correct
};
```

### Why React Query?

- **Request deduplication** - Multiple components using the same hook = 1 network request
- **Automatic caching** - Reduces unnecessary network calls
- **refetchOnWindowFocus** - Handles mobile backgrounding automatically
- **Supabase as source of truth** - Data lives in database, React Query handles sync
- **No manual loading/error state** - React Query manages this automatically

---

## Mobile Backgrounding Recovery

When mobile browsers background an app, in-flight requests can get "stuck" and connections become stale. The app handles this automatically:

### How It Works

1. **React Query's `refetchOnWindowFocus: true`** - Automatically refetches all active queries when the browser tab becomes visible again
2. **App Recovery Provider** - Tracks visibility changes and manages auth state refresh
3. **Auth Confidence Tracking** - Prevents false login modals during refresh periods

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  QueryProvider (React Query)                                 │
│  - refetchOnWindowFocus: true (handles data refetching)      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  AppRecoveryProvider                                    │ │
│  │  - Tracks visibility changes                            │ │
│  │  - Refreshes auth state after backgrounding             │ │
│  │  - Provides isRefreshing state (prevents login flash)   │ │
│  │  ┌─────────────────────────────────────────────────────┐│ │
│  │  │  AuthProvider                                       ││ │
│  │  │  - Manages user authentication                      ││ │
│  │  │  - Tracks auth confidence level                     ││ │
│  │  └─────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/providers/query-provider.tsx` | React Query configuration with `refetchOnWindowFocus` |
| `src/providers/app-recovery-provider.tsx` | Auth refresh and `isRefreshing` state |
| `src/hooks/use-recovery.ts` | Consumer hooks for recovery state |

### Usage in Components

```typescript
// app-shell.tsx uses isRefreshing to prevent login modal flash
const { isRefreshing } = useRecoveryState();

const shouldShowAuth = initialized && !user && confidence === "confirmed" && !isRefreshing;
```

---

## Auth Initialization & Performance

### Problem: Slow Initial Page Load

On initial page load or hard refresh, the app needs to:
1. Check if the user has an existing session (auth)
2. Fetch the user's profile
3. Enable data hooks to fetch projects, tasks, etc.

Previously, profile fetch was **blocking** - the user state wasn't set until profile fetch completed (or timed out after 6+ seconds). This caused:
- 6-7 second delays on initial load
- "Project not found" errors when refreshing project pages
- Poor user experience on cold starts

### Solution: Non-Blocking Profile Fetch

Profile fetch is now non-blocking:

```typescript
// In use-auth.tsx
if (event === "SIGNED_IN" && session?.user) {
  // CRITICAL: Set user immediately so data hooks can start fetching
  setState({
    user: session.user,
    profile: null, // Will be updated when profile fetch completes
    session,
    loading: false,
    initialized: true,
    confidence: "confirmed",
  });

  // Fetch profile in background (non-blocking)
  fetchProfile(session.user.id, useInitialTimeout).then((profile) => {
    // Only update if still mounted and user hasn't signed out
    if (profile && isMountedRef.current) {
      setState((prev) => (prev.user ? { ...prev, profile } : prev));
    }
  });
}
```

**Key benefits:**
- User is set **immediately** when SIGNED_IN fires
- Data hooks with `enabled: !!user` can start fetching right away
- Profile is updated when it eventually loads (non-critical)
- Initial page load is now ~instant

### Timeout Configuration

Two tiers of timeouts handle different scenarios:

| Timeout | Value | Use Case |
|---------|-------|----------|
| `AUTH_SESSION_INITIAL` | 8000ms | Initial page load (cold start can be slow) |
| `DATA_QUERY_INITIAL` | 6000ms | Initial data fetch |
| `AUTH_SESSION` | 3000ms | Recovery after mobile backgrounding |
| `DATA_QUERY` | 3000ms | Recovery data refresh |

**Why two tiers?**
- **Initial load** may be slow due to Supabase cold starts, CDN latency, etc.
- **Recovery** should be fast - if data can't load in 3 seconds after backgrounding, the connection is likely stale

### Safety Patterns

**Preventing state updates after unmount:**
```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  // ... auth logic

  return () => {
    isMountedRef.current = false;
    subscription.unsubscribe();
  };
}, []);

// In async callback:
if (profile && isMountedRef.current) {
  setState((prev) => (prev.user ? { ...prev, profile } : prev));
}
```

**Preventing profile update after sign-out:**
```typescript
// Only update profile if user still exists
setState((prev) => (prev.user ? { ...prev, profile } : prev));
```

### Architecture Decision: Profile is Non-Critical

The profile contains display preferences (name, avatar) but is not required for core functionality. By making it non-blocking:
- App loads immediately with user ID available
- Data hooks can fetch projects/tasks right away
- Profile loads in background and UI updates when ready
- If profile fails, app still works (just without display name/avatar)

---

## Error Handling

### API Error Pattern

```typescript
interface ApiResult<T> {
  data: T | null;
  error: Error | null;
}

async function fetchData<T>(query: () => Promise<{ data: T; error: any }>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await query();

    if (error) {
      console.error("Supabase error:", error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { data: null, error: err instanceof Error ? err : new Error("Unknown error") };
  }
}
```

### UI Error States

```typescript
function TaskList() {
  const { tasks, loading, error } = useTasks();

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorMessage
        message="Failed to load tasks"
        onRetry={() => refetch()}
      />
    );
  }

  if (tasks.length === 0) {
    return <EmptyState message="No tasks yet" />;
  }

  return <TaskGrid tasks={tasks} />;
}
```

---

## Performance Considerations

### Optimizations Implemented

1. **React Query Request Deduplication**
   - Multiple components using the same hook = 1 network request
   - Example: 5 components calling `useProjects()` = 1 Supabase query
   - Before React Query: 252 requests per navigation → After: 5-9 requests

2. **Optimistic UI Updates**
   ```typescript
   // Update React Query cache immediately
   queryClient.setQueryData(projectKeys.detail(id), (old) => ({
     ...old,
     ...data,
   }));
   // Sync to database
   await supabase.from("projects").update(data).eq("id", id);
   // No refetch needed - cache is already correct
   ```

3. **Scalable Data Fetching**
   ```typescript
   // useProfiles only fetches team members, not all users
   async function fetchTeamProfiles(userId: string) {
     // 1. Get projects user has access to
     // 2. Get user IDs from those projects
     // 3. Fetch only those profiles
     return supabase.from("profiles").select("*").in("id", teamUserIds);
   }
   ```

4. **Caching Strategy**
   ```typescript
   // Different stale times based on data volatility
   staleTime: 30 * 1000,      // Tasks/Projects: 30 seconds
   staleTime: 5 * 60 * 1000,  // Profiles: 5 minutes (rarely change)
   ```

5. **Memoized Callbacks**
   ```typescript
   // IMPORTANT: Never include derived state in dependencies
   const fetchData = useCallback(() => { ... }, [userId]);  // ✓ GOOD
   const fetchData = useCallback(() => { ... }, [data.length]);  // ✗ BAD (infinite loop)
   ```

### Common Pitfalls to Avoid

1. **Infinite Re-render Loops**
   ```typescript
   // BAD - data.length changes after fetch, creating infinite loop
   const fetchData = useCallback(() => { ... }, [data.length]);

   // GOOD - stable dependencies only
   const fetchData = useCallback(() => { ... }, [userId]);
   ```

2. **Object References in Dependencies**
   ```typescript
   // BAD - object reference changes every render
   const fetchItem = useCallback(() => { ... }, [item]);

   // GOOD - use primitive identifier
   const fetchItem = useCallback(() => { ... }, [itemId]);
   ```

### Future Optimizations

- **Virtual scrolling** for long task lists (100+ items)
- **Realtime subscriptions** via Supabase for multi-user sync
- **Service worker** for offline support
- **React Suspense** for data loading

---

## Testing Guidelines

### Recommended Testing Stack

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

### Test Structure

```
__tests__/
├── components/
│   ├── task-card.test.tsx
│   └── kanban-board.test.tsx
├── hooks/
│   └── use-tasks.test.ts
├── lib/
│   ├── validation.test.ts
│   └── sanitize.test.ts
└── e2e/
    └── tasks.spec.ts
```

### Unit Test Example

```typescript
// __tests__/lib/sanitize.test.ts
import { sanitizeString, sanitizeUrl } from "@/lib/security/sanitize";

describe("sanitizeString", () => {
  it("escapes HTML characters", () => {
    expect(sanitizeString("<script>alert('xss')</script>"))
      .toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
  });

  it("removes javascript: protocol", () => {
    expect(sanitizeString("javascript:alert(1)")).toBe("alert(1)");
  });
});

describe("sanitizeUrl", () => {
  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("adds https:// if missing", () => {
    expect(sanitizeUrl("example.com")).toBe("https://example.com");
  });
});
```

### Component Test Example

```typescript
// __tests__/components/task-card.test.tsx
import { render, screen } from "@testing-library/react";
import { TaskCard } from "@/components/task/task-card";

const mockTask = {
  id: "1",
  title: "Test Task",
  status: "todo",
  priority: "high",
  // ...
};

describe("TaskCard", () => {
  it("renders task title", () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("shows priority badge", () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });
});
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in Vercel
3. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |

---

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repo-url>
cd experiment-pm

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Code Style

- **ESLint** - Run `npm run lint` before committing
- **TypeScript** - Strict mode enabled, no `any` types
- **Formatting** - Use Prettier with default config

### Commit Messages

Follow conventional commits:
```
feat: add task archiving
fix: resolve drag-drop position bug
docs: update README
refactor: extract form validation
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `npm run lint` and `npm run build`
4. Submit PR with description
5. Address review feedback
6. Merge after approval

---

## Appendix

### Useful Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

# Supabase
npx supabase gen types typescript --project-id <id> > src/types/database.ts

# shadcn/ui
npx shadcn@latest add <component>
```

### Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [@dnd-kit Documentation](https://docs.dndkit.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zod Documentation](https://zod.dev/)

---

*Last updated: February 2026*
