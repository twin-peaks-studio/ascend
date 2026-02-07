-- Update avatar RLS policies for team-based privacy
-- Drop the old public read policy
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- Create team-based avatar access policy
-- Users can view avatars of:
--   1. Themselves (always)
--   2. Team members (people in the same projects)
CREATE POLICY "Users can view team member avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    -- Case 1: User viewing their own avatar
    (storage.foldername(name))[1] = auth.uid()::text

    OR

    -- Case 2: User viewing a team member's avatar
    -- Check if current user shares any project with the avatar owner
    EXISTS (
      SELECT 1
      FROM project_members pm1
      INNER JOIN project_members pm2
        ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
        AND pm2.user_id = ((storage.foldername(name))[1])::uuid
    )

    OR

    -- Case 3: User owns projects that the avatar owner is a member of
    EXISTS (
      SELECT 1
      FROM projects p
      INNER JOIN project_members pm
        ON p.id = pm.project_id
      WHERE p.created_by = auth.uid()
        AND pm.user_id = ((storage.foldername(name))[1])::uuid
    )

    OR

    -- Case 4: Avatar owner owns projects that current user is a member of
    EXISTS (
      SELECT 1
      FROM projects p
      INNER JOIN project_members pm
        ON p.id = pm.project_id
      WHERE p.created_by = ((storage.foldername(name))[1])::uuid
        AND pm.user_id = auth.uid()
    )
  )
);

-- Add helpful comment
COMMENT ON POLICY "Users can view team member avatars" ON storage.objects IS
'Team-based avatar privacy: Users can only see avatars of themselves and people they share projects with';
