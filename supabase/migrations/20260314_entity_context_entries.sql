-- Entity Context Entries (Journal)
-- Timestamped freeform knowledge entries scoped to an entity.
-- Used alongside foundational_context for the hybrid memory approach:
--   foundational_context = permanent truth (rarely changes)
--   context entries = evolving knowledge (journal-style, timestamped)
-- The AI memory refresh synthesizes both into ai_memory.

CREATE TABLE IF NOT EXISTS public.entity_context_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_context_entries_entity
  ON public.entity_context_entries(entity_id, created_at DESC);

-- RLS: workspace members can manage context entries
ALTER TABLE public.entity_context_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view context entries"
  ON public.entity_context_entries FOR SELECT
  USING (entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace members can insert context entries"
  ON public.entity_context_entries FOR INSERT
  WITH CHECK (entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace members can update context entries"
  ON public.entity_context_entries FOR UPDATE
  USING (entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace members can delete context entries"
  ON public.entity_context_entries FOR DELETE
  USING (entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));
