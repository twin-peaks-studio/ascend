-- Make workspace_id optional on projects and notes
--
-- Workspaces are an opt-in feature. Projects and notes created without
-- a workspace context get workspace_id = NULL (global/unscoped).
--
-- NOTE: The RLS fix for workspace_members (is_workspace_member function)
-- was applied manually via the Supabase Dashboard SQL Editor.

ALTER TABLE public.projects ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.notes ALTER COLUMN workspace_id DROP NOT NULL;
