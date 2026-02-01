-- Migration: Add user authentication and project sharing support
-- This migration adds the required database changes for user authentication,
-- user-data linking, and project member invitation functionality.
--
-- Run this in your Supabase SQL Editor or via migration tool.

-- =============================================================================
-- 1. Add created_by column to projects table
-- =============================================================================

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS created_by UUID NOT NULL REFERENCES auth.users(id);

-- Create index for faster queries by creator
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

-- =============================================================================
-- 1b. Add additional project fields (due_date, priority, lead_id)
-- =============================================================================

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES auth.users(id);

-- Create index for lead lookups
CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON public.projects(lead_id);

-- =============================================================================
-- 2. Add created_by column to tasks table
-- =============================================================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS created_by UUID NOT NULL REFERENCES auth.users(id);

-- Create index for faster queries by creator
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);

-- =============================================================================
-- 3. Create project_members table for project sharing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,

    -- Ensure a user can only be a member once per project
    UNIQUE(project_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- =============================================================================
-- 4. Update profiles table to ensure it syncs with auth.users
-- =============================================================================

-- Add trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- Profiles policies
-- -----------------------------------------------

-- Users can view all profiles (needed for member lookup by email)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- -----------------------------------------------
-- Projects policies
-- -----------------------------------------------

-- Users can view projects they created or are members of
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR id IN (
            SELECT project_id FROM public.project_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create projects (automatically assigned as creator)
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Users can update projects they created or own
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR id IN (
            SELECT project_id FROM public.project_members
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Users can delete projects they created
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- -----------------------------------------------
-- Tasks policies
-- -----------------------------------------------

-- Users can view tasks from accessible projects or tasks they created
DROP POLICY IF EXISTS "Users can view accessible tasks" ON public.tasks;
CREATE POLICY "Users can view accessible tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can create tasks
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
CREATE POLICY "Users can create tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Users can update tasks they created or from accessible projects
DROP POLICY IF EXISTS "Users can update accessible tasks" ON public.tasks;
CREATE POLICY "Users can update accessible tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can delete tasks they created or from their projects
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
    );

-- -----------------------------------------------
-- Project documents policies
-- -----------------------------------------------

-- Users can view documents from accessible projects
DROP POLICY IF EXISTS "Users can view accessible documents" ON public.project_documents;
CREATE POLICY "Users can view accessible documents"
    ON public.project_documents FOR SELECT
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can create documents in accessible projects
DROP POLICY IF EXISTS "Users can create documents" ON public.project_documents;
CREATE POLICY "Users can create documents"
    ON public.project_documents FOR INSERT
    TO authenticated
    WITH CHECK (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can update documents in accessible projects
DROP POLICY IF EXISTS "Users can update documents" ON public.project_documents;
CREATE POLICY "Users can update documents"
    ON public.project_documents FOR UPDATE
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can delete documents from their projects
DROP POLICY IF EXISTS "Users can delete own documents" ON public.project_documents;
CREATE POLICY "Users can delete own documents"
    ON public.project_documents FOR DELETE
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
    );

-- -----------------------------------------------
-- Project members policies
-- -----------------------------------------------

-- Users can view members of projects they have access to
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
CREATE POLICY "Users can view project members"
    ON public.project_members FOR SELECT
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
        )
    );

-- Project owners can add members
DROP POLICY IF EXISTS "Owners can add project members" ON public.project_members;
CREATE POLICY "Owners can add project members"
    ON public.project_members FOR INSERT
    TO authenticated
    WITH CHECK (
        invited_by = auth.uid()
        AND (
            project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR project_id IN (
                SELECT project_id FROM public.project_members
                WHERE user_id = auth.uid() AND role = 'owner'
            )
        )
    );

-- Project owners can remove members
DROP POLICY IF EXISTS "Owners can remove project members" ON public.project_members;
CREATE POLICY "Owners can remove project members"
    ON public.project_members FOR DELETE
    TO authenticated
    USING (
        -- Allow owners to remove anyone (except creator)
        (
            project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR project_id IN (
                SELECT project_id FROM public.project_members
                WHERE user_id = auth.uid() AND role = 'owner'
            )
        )
        -- Also allow users to remove themselves
        OR user_id = auth.uid()
    );

-- -----------------------------------------------
-- Attachments policies
-- -----------------------------------------------

-- Users can view attachments for accessible entities
DROP POLICY IF EXISTS "Users can view accessible attachments" ON public.attachments;
CREATE POLICY "Users can view accessible attachments"
    ON public.attachments FOR SELECT
    TO authenticated
    USING (
        (entity_type = 'project' AND entity_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
            UNION
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        ))
        OR
        (entity_type = 'task' AND entity_id IN (
            SELECT id FROM public.tasks WHERE created_by = auth.uid()
            UNION
            SELECT t.id FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE p.created_by = auth.uid()
            UNION
            SELECT t.id FROM public.tasks t
            JOIN public.project_members pm ON t.project_id = pm.project_id
            WHERE pm.user_id = auth.uid()
        ))
    );

-- Users can create attachments for accessible entities
DROP POLICY IF EXISTS "Users can create attachments" ON public.attachments;
CREATE POLICY "Users can create attachments"
    ON public.attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        (entity_type = 'project' AND entity_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
            UNION
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        ))
        OR
        (entity_type = 'task' AND entity_id IN (
            SELECT id FROM public.tasks WHERE created_by = auth.uid()
            UNION
            SELECT t.id FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            WHERE p.created_by = auth.uid()
            UNION
            SELECT t.id FROM public.tasks t
            JOIN public.project_members pm ON t.project_id = pm.project_id
            WHERE pm.user_id = auth.uid()
        ))
    );

-- Users can delete their attachments
DROP POLICY IF EXISTS "Users can delete attachments" ON public.attachments;
CREATE POLICY "Users can delete attachments"
    ON public.attachments FOR DELETE
    TO authenticated
    USING (
        (entity_type = 'project' AND entity_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        ))
        OR
        (entity_type = 'task' AND entity_id IN (
            SELECT id FROM public.tasks WHERE created_by = auth.uid()
        ))
    );

-- =============================================================================
-- 6. Grant necessary permissions
-- =============================================================================

-- Ensure authenticated users can access the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;

-- =============================================================================
-- Notes:
-- =============================================================================
--
-- After running this migration:
-- 1. Make sure to enable Email Auth in Supabase Dashboard > Authentication > Providers
-- 2. Configure email templates for signup confirmation if needed
-- 3. For development, you can disable email confirmation in:
--    Supabase Dashboard > Authentication > Email Templates > Confirm signup (toggle off)
--
-- Existing data:
-- If you have existing projects/tasks without created_by, you'll need to either:
-- - Delete them before running this migration, OR
-- - First add the columns as nullable, update existing rows, then make them NOT NULL
--
-- To handle existing data, use this alternative approach:
--
-- ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
-- UPDATE public.projects SET created_by = (SELECT id FROM auth.users LIMIT 1) WHERE created_by IS NULL;
-- ALTER TABLE public.projects ALTER COLUMN created_by SET NOT NULL;
--
