-- =============================================================================
-- NOTES FEATURE MIGRATION
-- =============================================================================
-- This migration adds notes functionality to projects.
-- Notes can be linked to projects and have tasks created from them.
--
-- Run this in your Supabase SQL Editor or via migration tool.

-- =============================================================================
-- 1. Create notes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);

-- =============================================================================
-- 2. Create note_tasks junction table (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.note_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure a task can only be linked to a note once
    UNIQUE(note_id, task_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_note_tasks_note_id ON public.note_tasks(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tasks_task_id ON public.note_tasks(task_id);

-- =============================================================================
-- 3. Row Level Security (RLS) Policies for notes
-- =============================================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tasks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- Notes policies (follow project access patterns)
-- -----------------------------------------------

-- Users can view notes from accessible projects
DROP POLICY IF EXISTS "Users can view accessible notes" ON public.notes;
CREATE POLICY "Users can view accessible notes"
    ON public.notes FOR SELECT
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can create notes in accessible projects
DROP POLICY IF EXISTS "Users can create notes" ON public.notes;
CREATE POLICY "Users can create notes"
    ON public.notes FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND (
            project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    );

-- Users can update notes in accessible projects
DROP POLICY IF EXISTS "Users can update notes" ON public.notes;
CREATE POLICY "Users can update notes"
    ON public.notes FOR UPDATE
    TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
        OR project_id IN (
            SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        )
    );

-- Users can delete notes from their projects or notes they created
DROP POLICY IF EXISTS "Users can delete notes" ON public.notes;
CREATE POLICY "Users can delete notes"
    ON public.notes FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE created_by = auth.uid()
        )
    );

-- -----------------------------------------------
-- Note_tasks policies
-- -----------------------------------------------

-- Users can view note_tasks for accessible notes
DROP POLICY IF EXISTS "Users can view note_tasks" ON public.note_tasks;
CREATE POLICY "Users can view note_tasks"
    ON public.note_tasks FOR SELECT
    TO authenticated
    USING (
        note_id IN (
            SELECT id FROM public.notes n
            WHERE n.project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR n.project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    );

-- Users can create note_tasks for accessible notes
DROP POLICY IF EXISTS "Users can create note_tasks" ON public.note_tasks;
CREATE POLICY "Users can create note_tasks"
    ON public.note_tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        note_id IN (
            SELECT id FROM public.notes n
            WHERE n.project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR n.project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    );

-- Users can delete note_tasks from accessible notes
DROP POLICY IF EXISTS "Users can delete note_tasks" ON public.note_tasks;
CREATE POLICY "Users can delete note_tasks"
    ON public.note_tasks FOR DELETE
    TO authenticated
    USING (
        note_id IN (
            SELECT id FROM public.notes n
            WHERE n.project_id IN (
                SELECT id FROM public.projects WHERE created_by = auth.uid()
            )
            OR n.project_id IN (
                SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
            )
        )
    );

-- =============================================================================
-- 4. Grant permissions
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.note_tasks TO authenticated;
