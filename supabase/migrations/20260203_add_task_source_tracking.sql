-- Add source tracking to tasks table for AI-generated tasks
-- source_type tracks how the task was created:
--   'manual' - created by user directly (default)
--   'ai_extraction' - extracted by AI from notes/descriptions

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual'
CHECK (source_type IN ('manual', 'ai_extraction'));

-- Add comment for documentation
COMMENT ON COLUMN tasks.source_type IS 'How the task was created: manual (default) or ai_extraction';
