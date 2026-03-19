-- Phase 4.7A: task_entities junction table — many-to-many linking between tasks and entities
CREATE TABLE task_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- denormalized from entities.entity_type for display queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, entity_id)
);

CREATE INDEX idx_task_entities_task_id ON task_entities(task_id);
CREATE INDEX idx_task_entities_entity_id ON task_entities(entity_id);

ALTER TABLE task_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage task entities"
  ON task_entities FOR ALL
  USING (entity_id IN (
    SELECT id FROM entities WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  ));
