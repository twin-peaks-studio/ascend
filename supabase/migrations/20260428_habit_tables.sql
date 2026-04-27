-- Habit Tracker
-- habits: user-defined recurring practices with frequency targets
-- habit_entries: individual check-in sessions (one per session, multiple per day allowed)

-- ============================================================
-- 1. habits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  frequency_type TEXT NOT NULL DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly', 'monthly')),
  frequency_count INTEGER NOT NULL DEFAULT 1,
  frequency_days INTEGER[],  -- JS getDay() values (0=Sun,1=Mon,...,6=Sat); set for specific-day weekly habits
  time_goal_minutes INTEGER,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_workspace_id ON public.habits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON public.habits(user_id, is_archived);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view their own habits"
  ON public.habits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert their own habits"
  ON public.habits FOR INSERT
  WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "users can update their own habits"
  ON public.habits FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete their own habits"
  ON public.habits FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 2. habit_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_id ON public.habit_entries(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date ON public.habit_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON public.habit_entries(habit_id, entry_date DESC);

ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view their own habit entries"
  ON public.habit_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert their own habit entries"
  ON public.habit_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update their own habit entries"
  ON public.habit_entries FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete their own habit entries"
  ON public.habit_entries FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 3. updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER habit_entries_updated_at
  BEFORE UPDATE ON public.habit_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. entity_mentions: add 'habit_entry' to source_type
-- ============================================================
ALTER TABLE public.entity_mentions
  DROP CONSTRAINT IF EXISTS entity_mentions_source_type_check;

ALTER TABLE public.entity_mentions
  ADD CONSTRAINT entity_mentions_source_type_check
  CHECK (source_type IN ('note', 'comment', 'task_description', 'capture', 'habit_entry'));
