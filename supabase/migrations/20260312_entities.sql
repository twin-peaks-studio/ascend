-- Entity Memory System
-- Phase 1A: Creates entities, entity_links, entity_mentions tables
-- and bridge columns on projects/tasks.
-- All additive — no existing tables are altered destructively.

-- ============================================================
-- 1. entities — products, initiatives, stakeholders, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'initiative', 'stakeholder')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  foundational_context TEXT,
  ai_memory TEXT,
  memory_refreshed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_entities_workspace ON public.entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(workspace_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_slug ON public.entities(workspace_id, slug);

-- ============================================================
-- 2. entity_links — many-to-many between entities
--    e.g. initiative ↔ product, stakeholder ↔ product
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN (
    'initiative_product',
    'stakeholder_product',
    'stakeholder_initiative'
  )),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_entity_id, target_entity_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_source ON public.entity_links(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON public.entity_links(target_entity_id);

-- ============================================================
-- 3. entity_mentions — tracks where entities are @mentioned
--    Polymorphic: source_type + source_id point to any content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'note', 'comment', 'task_description', 'capture'
  )),
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON public.entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_source ON public.entity_mentions(source_type, source_id);

-- ============================================================
-- 4. Bridge columns on existing tables
--    Additive only — nullable FKs, no data changes
-- ============================================================

-- projects.entity_id — links a project to its entity counterpart (initiative)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- tasks.initiative_entity_id — optional direct link to an initiative entity
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS initiative_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- ============================================================
-- 5. RLS policies — workspace members can manage entities
-- ============================================================
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_mentions ENABLE ROW LEVEL SECURITY;

-- entities: workspace members can CRUD
CREATE POLICY "workspace members can view entities"
  ON public.entities FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert entities"
  ON public.entities FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update entities"
  ON public.entities FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can delete entities"
  ON public.entities FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- entity_links: accessible if user can access the source entity's workspace
CREATE POLICY "workspace members can view entity links"
  ON public.entity_links FOR SELECT
  USING (source_entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace members can insert entity links"
  ON public.entity_links FOR INSERT
  WITH CHECK (source_entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace members can delete entity links"
  ON public.entity_links FOR DELETE
  USING (source_entity_id IN (
    SELECT id FROM public.entities WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

-- entity_mentions: workspace members can manage
CREATE POLICY "workspace members can view entity mentions"
  ON public.entity_mentions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert entity mentions"
  ON public.entity_mentions FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can delete entity mentions"
  ON public.entity_mentions FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
