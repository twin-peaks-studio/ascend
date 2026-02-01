# Ascend - Project & Task Management

A modern, Linear-inspired task management application with Kanban boards, project organization, and cross-device sync via Supabase.

## Features

- **Kanban Board**: Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Project Management**: Linear-style projects with descriptions, documents, and links
- **Multiple Tasks Per Project**: Organize many tasks under a single project
- **Dark Mode**: Toggle between light and dark themes
- **Keyboard Shortcuts**: Quick actions with Cmd/Ctrl + K (create task), Cmd/Ctrl + P (create project)
- **Enterprise Security**: Input sanitization, XSS prevention, CSP headers
- **Fully Responsive**: Adaptive layouts for desktop, tablet, and mobile
  - Desktop: Collapsible sidebar navigation
  - Tablet/Mobile: Floating bottom navigation bar
  - Project properties: Collapsible panel (desktop/tablet) or bottom sheet (mobile)

## Tech Stack

- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **@dnd-kit** - Drag-and-drop
- **Supabase** - Database & auth-ready backend
- **Zod** - Runtime validation

## Getting Started

### Prerequisites

- Node.js 20.9+ (required for Next.js 16)
- npm
- Supabase account

### 1. Clone and Install

```bash
git clone <your-repo>
cd experiment-pm
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the following schema:

```sql
-- Projects table (Linear-style)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table (multiple tasks per project)
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

-- Project documents/links (Linear-style)
CREATE TABLE project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  content TEXT,
  type TEXT DEFAULT 'link' CHECK (type IN ('link', 'document', 'note')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- For now (no auth): allow all operations
CREATE POLICY "Allow all" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all" ON project_documents FOR ALL USING (true);
```

### 3. Configure Environment

Copy the example environment file and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase project URL and anon key (found in Project Settings > API):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick create task |
| `Cmd/Ctrl + P` | Quick create project |
| `Cmd/Ctrl + /` | Show shortcuts help |
| `?` | Show shortcuts help |
| `Escape` | Close dialog |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── tasks/page.tsx     # Kanban board
│   ├── projects/          # Projects pages
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # App shell, sidebar, header
│   ├── board/             # Kanban board components
│   ├── task/              # Task card, form, dialog
│   └── project/           # Project card, form, dialog
├── hooks/                 # Custom React hooks
├── lib/
│   ├── supabase/          # Supabase client setup
│   ├── security/          # Sanitization, CSP headers
│   └── validation.ts      # Zod schemas
└── types/                 # TypeScript types
```

## Security Features

- **Input Sanitization**: All user input is sanitized before storage and display
- **XSS Prevention**: No dangerouslySetInnerHTML, all content escaped
- **URL Validation**: Only HTTP/HTTPS URLs allowed, javascript: protocol blocked
- **CSP Headers**: Content Security Policy to prevent script injection
- **Parameterized Queries**: Supabase client prevents SQL injection
- **Zod Validation**: Runtime type checking on all inputs

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Other Platforms

The app is a standard Next.js application and can be deployed anywhere that supports Node.js 20+.

## License

MIT
