-- Revert workspace_id back to NOT NULL on projects and notes
--
-- workspace_id was temporarily made nullable as a workaround for broken
-- RLS policies on workspace_members. Now that the RLS is fixed (via
-- is_workspace_member SECURITY DEFINER function), workspaces load
-- correctly and workspace_id should always be provided.
--
-- Before running this, ensure:
-- 1. All projects have workspace_id set (no NULLs)
-- 2. All notes have workspace_id set (no NULLs)

-- Backfill any NULL workspace_id projects to the creator's workspace
UPDATE projects p
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = p.created_by
  LIMIT 1
)
WHERE p.workspace_id IS NULL;

-- Backfill any NULL workspace_id notes to the creator's workspace
UPDATE notes n
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = n.created_by
  LIMIT 1
)
WHERE n.workspace_id IS NULL;

-- Re-enforce NOT NULL
ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN workspace_id SET NOT NULL;
