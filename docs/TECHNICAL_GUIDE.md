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
11. [Drag and Drop](#drag-and-drop)
12. [Styling System](#styling-system)
13. [State Management](#state-management)
14. [Error Handling](#error-handling)
15. [Performance Considerations](#performance-considerations)
16. [Testing Guidelines](#testing-guidelines)
17. [Deployment](#deployment)
18. [Contributing](#contributing)

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
│           └── page.tsx         # Project detail (/projects/[id])
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
│   │   ├── task-dialog.tsx      # Task quick create/edit modal
│   │   ├── task-details-dialog.tsx  # Full task details modal (Todoist-style, desktop)
│   │   ├── task-edit-mobile.tsx     # Mobile task edit drawer (Todoist-style)
│   │   └── task-details-responsive.tsx  # Responsive wrapper (auto-switches desktop/mobile)
│   │
│   ├── project/                 # Project-related components
│   │   ├── project-card.tsx     # Project card for list view (links to detail page)
│   │   ├── project-form.tsx     # Create project form
│   │   ├── project-dialog.tsx   # Create project modal
│   │   └── properties-panel.tsx # Reusable properties sidebar component
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
│   ├── use-projects.ts          # Project CRUD operations
│   ├── use-tasks.ts             # Task CRUD operations
│   ├── use-documents.ts         # Document CRUD operations
│   ├── use-keyboard-shortcuts.ts # Global keyboard shortcuts
│   ├── use-media-query.ts       # Responsive breakpoint detection
│   └── use-sidebar.tsx          # Sidebar collapse state context
│
├── lib/
│   ├── utils.ts                 # Utility functions (cn, etc.)
│   ├── validation.ts            # Zod schemas
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   └── security/
│       └── sanitize.ts          # Input sanitization
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

### useProjects (`src/hooks/use-projects.ts`)

```typescript
interface UseProjectsReturn {
  projects: ProjectWithRelations[];
  loading: boolean;
  error: Error | null;
  createProject: (data: CreateProjectInput) => Promise<Project | null>;
  updateProject: (id: string, data: UpdateProjectInput) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`*, tasks:tasks(*)`)
      .order("updated_at", { ascending: false });

    // ... handle response
  }, []);

  // ... CRUD operations

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch };
}
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

### Task Details Dialog

The `TaskDetailsDialog` component provides a Todoist-style full details view:

**Layout:**
- Two-column responsive layout (`md:grid-cols-[1fr_260px]`)
- Size: 80vw width (max 1100px), 75vh height
- Left panel: Title with checkbox, description, attachments (scrollable)
- Right sidebar: Project, assignee, date, priority, status

**Inline Editing Pattern:**
```typescript
// Title/Description: Explicit save/cancel buttons
{isEditingTitle ? (
  <div className="flex-1 space-y-2">
    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleTitleSave}>Save</Button>
      <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
    </div>
  </div>
) : (
  <button onClick={() => setIsEditingTitle(true)}>{task.title}</button>
)}

// Sidebar fields: Immediate save on change (no refetch needed)
<Select value={task.priority} onValueChange={handlePriorityChange}>
  {/* Options */}
</Select>
```

**State Synchronization (Optimistic Updates):**
The parent component updates `selectedTask` immediately after successful updates. **Important:** Do NOT call `refetch()` after updates - this causes a visible UI glitch. Local state updates are sufficient:

```typescript
const handleDetailsUpdate = useCallback(async (data: UpdateTaskInput) => {
  if (!selectedTask) return;
  const result = await updateTask(selectedTask.id, data);
  if (result) {
    // Update selectedTask immediately for responsive UI
    setSelectedTask((prev) => prev ? { ...prev, ...data } : null);
    // Don't call refetch() - local state update is sufficient and avoids UI glitch
  }
}, [selectedTask, updateTask, activeProjects]);
```

**CSS Specificity Note:**
When overriding Tailwind responsive classes in shadcn/ui components, use matching responsive prefixes:
```typescript
// Base DialogContent has: sm:max-w-lg
// To override at sm+ breakpoint, use: sm:max-w-[1100px]
<DialogContent className="w-[80vw] sm:max-w-[1100px] h-[75vh]">
```

### Mobile Task Edit (Responsive)

The task details experience is responsive, automatically switching between desktop dialog and mobile drawer based on screen size.

**Architecture:**
```
TaskDetailsResponsive (wrapper)
├── Desktop (≥768px): TaskDetailsDialog
│   └── Two-column dialog with sidebar
└── Mobile (<768px): TaskEditMobile
    └── Bottom drawer with Todoist-style layout
```

**Responsive Detection (`src/hooks/use-media-query.ts`):**
```typescript
// Uses useSyncExternalStore for proper React 18 SSR compatibility
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    getServerSnapshot  // Returns false on server to avoid hydration mismatch
  );
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
```

**Mobile Layout (Todoist-inspired):**
- Bottom drawer using `vaul` library
- Title with completion toggle circle at top
- Populated fields shown as tappable rows with icons
- Empty fields shown as horizontal scrollable chips
- Collapsible attachments section

**Key Mobile UI Patterns:**

1. **Property Rows** - For populated fields:
```typescript
const PropertyRow = forwardRef<HTMLButtonElement, Props>(
  ({ icon: Icon, children, onClick, className, ...props }, ref) => (
    <button
      ref={ref}
      className="flex items-center gap-3 w-full py-3 border-b border-border/40"
      {...props}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">{children}</div>
    </button>
  )
);
```

2. **Property Chips** - Horizontal scroll for empty fields:
```typescript
// Shows chips for: Description, Date, Assignee, Attachments (when empty)
<div className="py-3 -mx-4 px-4 overflow-x-auto">
  <div className="flex items-center gap-2">
    {!hasDescription && <PropertyChip icon={AlignLeft} label="Description" />}
    {!hasDueDate && <PropertyChip icon={Calendar} label="Date" />}
    {!hasAssignee && <PropertyChip icon={User} label="Assignee" />}
    {attachments.length === 0 && <PropertyChip icon={Paperclip} label="Attachments" />}
  </div>
</div>
```

3. **Drawer Component** (`src/components/ui/drawer.tsx`):
```typescript
// Uses vaul library for native-feeling mobile drawer
import { Drawer as DrawerPrimitive } from "vaul";

<DrawerContent className="max-h-[90vh]">
  <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-muted" /> {/* Drag handle */}
  {children}
</DrawerContent>
```

**Usage in Pages:**
```typescript
// src/app/tasks/page.tsx
import { TaskDetailsResponsive } from "@/components/task";

<TaskDetailsResponsive
  open={showDetailsDialog}
  onOpenChange={setShowDetailsDialog}
  task={selectedTask}
  profiles={profiles}
  projects={activeProjects}
  onUpdate={handleDetailsUpdate}
/>
```

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
- Task cards are clickable buttons that open `TaskDetailsResponsive`
- Uses the same task details dialog as the Tasks page for consistency
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

### Local State Pattern

The app uses React's built-in state management:

```typescript
// Component-level state
const [isOpen, setIsOpen] = useState(false);

// Lifted state for shared data
function ParentComponent() {
  const [tasks, setTasks] = useState<Task[]>([]);

  return (
    <>
      <TaskList tasks={tasks} />
      <TaskForm onSubmit={(task) => setTasks(prev => [...prev, task])} />
    </>
  );
}
```

### Custom Hook State

Hooks encapsulate state and side effects:

```typescript
function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch, CRUD operations, etc.

  return { tasks, loading, /* ... */ };
}
```

### Why No Global State Library?

- **Simplicity** - App size doesn't warrant Redux/Zustand complexity
- **Supabase as source of truth** - Data lives in database, not client
- **React 19 features** - Built-in state management is sufficient
- **Easy to add later** - Can introduce if needed

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

1. **Optimistic UI Updates (No Refetch)**
   ```typescript
   // Update UI immediately with local state
   setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
   // Sync to database
   await supabase.from("tasks").update({ status }).eq("id", id);
   // DON'T call refetch() - it causes a visible UI glitch
   // Local state is already correct, no need to re-fetch all data
   ```

   **Why no refetch?** Calling `refetch()` after every update causes:
   - A double re-render (local state update + server data)
   - Visible UI "flash" or "glitch"
   - Unnecessary network requests

   The hooks already send updates to the server. Local state reflects what the user typed/selected, so it's already correct.

2. **Memoized Callbacks**
   ```typescript
   const handleDragEnd = useCallback(async (event: DragEndEvent) => {
     // ...
   }, [tasks, updateTaskPosition]);
   ```

3. **Lazy Loading**
   - Components load on-demand via Next.js App Router
   - Images use Next.js Image component with lazy loading

4. **Efficient Re-renders**
   - Props are primitives where possible
   - Arrays/objects memoized with useMemo
   - Event handlers wrapped in useCallback

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
