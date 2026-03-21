-- Task Context Entries
-- Timestamped freeform knowledge entries scoped to a task.
-- Used for recording research notes, findings, decisions, and context as you work.

CREATE TABLE IF NOT EXISTS public.task_context_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_context_entries_task
  ON public.task_context_entries(task_id, created_at DESC);

-- RLS: project members can manage task context entries
ALTER TABLE public.task_context_entries ENABLE ROW LEVEL SECURITY;

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
      )
    )
  );

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
      )
    )
  );

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
      )
    )
  );

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
      )
    )
  );
