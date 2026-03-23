-- Phase 1: Add workspace_members as an alternative access path to all project-scoped RLS policies.
-- This is additive — existing project_members checks still work. Nobody loses access.

-- Helper: reusable workspace membership check via project
-- "Is this user a member of the workspace that owns this project?"
CREATE OR REPLACE FUNCTION public.is_workspace_member_via_project(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = p_project_id
    AND wm.user_id = p_user_id
  );
$$;

-- ============================================================
-- SECTIONS — 4 policies (select, insert, update, delete)
-- ============================================================

DROP POLICY IF EXISTS "Users can view sections in their projects" ON public.sections;
CREATE POLICY "Users can view sections in their projects"
  ON public.sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sections.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = sections.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(sections.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can create sections in their projects" ON public.sections;
CREATE POLICY "Users can create sections in their projects"
  ON public.sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sections.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = sections.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(sections.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update sections in their projects" ON public.sections;
CREATE POLICY "Users can update sections in their projects"
  ON public.sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sections.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = sections.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(sections.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete sections in their projects" ON public.sections;
CREATE POLICY "Users can delete sections in their projects"
  ON public.sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = sections.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = sections.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(sections.project_id, auth.uid())
  );

-- ============================================================
-- FEEDBACK_FORMS — 4 policies (select, insert, update, delete)
-- ============================================================

DROP POLICY IF EXISTS "Project members can view feedback forms" ON public.feedback_forms;
CREATE POLICY "Project members can view feedback forms"
  ON public.feedback_forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = feedback_forms.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = feedback_forms.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(feedback_forms.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Project members can create feedback forms" ON public.feedback_forms;
CREATE POLICY "Project members can create feedback forms"
  ON public.feedback_forms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = feedback_forms.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = feedback_forms.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(feedback_forms.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Project members can update feedback forms" ON public.feedback_forms;
CREATE POLICY "Project members can update feedback forms"
  ON public.feedback_forms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = feedback_forms.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = feedback_forms.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(feedback_forms.project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Project members can delete feedback forms" ON public.feedback_forms;
CREATE POLICY "Project members can delete feedback forms"
  ON public.feedback_forms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = feedback_forms.project_id
      AND projects.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = feedback_forms.project_id
      AND project_members.user_id = auth.uid()
    )
    OR public.is_workspace_member_via_project(feedback_forms.project_id, auth.uid())
  );

-- ============================================================
-- FEEDBACK_SUBMISSIONS — 2 policies (select, delete)
-- INSERT/UPDATE are service-role only (no change needed)
-- ============================================================

DROP POLICY IF EXISTS "Project members can view feedback submissions" ON public.feedback_submissions;
CREATE POLICY "Project members can view feedback submissions"
  ON public.feedback_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_forms ff
      JOIN public.projects p ON p.id = ff.project_id
      WHERE ff.id = feedback_submissions.form_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = p.id
          AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = p.workspace_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Project members can delete feedback submissions" ON public.feedback_submissions;
CREATE POLICY "Project members can delete feedback submissions"
  ON public.feedback_submissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_forms ff
      JOIN public.projects p ON p.id = ff.project_id
      WHERE ff.id = feedback_submissions.form_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = p.id
          AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = p.workspace_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================
-- COMMENTS — 2 policies need update (select, insert)
-- UPDATE/DELETE are author-only (no change needed)
-- ============================================================

DROP POLICY IF EXISTS "Users can view comments in their team" ON public.comments;
CREATE POLICY "Users can view comments in their team"
  ON public.comments FOR SELECT
  USING (
    -- Comments on tasks the user can access
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = comments.task_id
      AND (
        tasks.created_by = auth.uid()
        OR tasks.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = tasks.project_id
          AND projects.created_by = auth.uid()
        )
        OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
      )
    )
    OR
    -- Comments on projects the user can access
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = comments.project_id
      AND (
        projects.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
        )
        OR public.is_workspace_member_via_project(projects.id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible items" ON public.comments;
CREATE POLICY "Users can create comments on accessible items"
  ON public.comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      -- Comment on task user has access to
      EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = comments.task_id
        AND (
          tasks.created_by = auth.uid()
          OR tasks.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
          )
          OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
        )
      )
      OR
      -- Comment on project user has access to
      EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = comments.project_id
        AND (
          projects.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
          )
          OR public.is_workspace_member_via_project(projects.id, auth.uid())
        )
      )
    )
  );

-- ============================================================
-- TASK_CONTEXT_ENTRIES — 4 policies (select, insert, update, delete)
-- ============================================================

DROP POLICY IF EXISTS "project members can view task context entries" ON public.task_context_entries;
CREATE POLICY "project members can view task context entries"
  ON public.task_context_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_context_entries.task_id
      AND (
        tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "project members can insert task context entries" ON public.task_context_entries;
CREATE POLICY "project members can insert task context entries"
  ON public.task_context_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_context_entries.task_id
      AND (
        tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "project members can update task context entries" ON public.task_context_entries;
CREATE POLICY "project members can update task context entries"
  ON public.task_context_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_context_entries.task_id
      AND (
        tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "project members can delete task context entries" ON public.task_context_entries;
CREATE POLICY "project members can delete task context entries"
  ON public.task_context_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_context_entries.task_id
      AND (
        tasks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members
          WHERE project_members.project_id = tasks.project_id
          AND project_members.user_id = auth.uid()
        )
        OR public.is_workspace_member_via_project(tasks.project_id, auth.uid())
      )
    )
  );
