-- Add type column to projects table
-- Backwards compatible: all existing projects default to 'standard'
-- Goals use the same project architecture but with a lightweight UX

ALTER TABLE projects
ADD COLUMN type text NOT NULL DEFAULT 'standard'
CHECK (type IN ('standard', 'goal'));

COMMENT ON COLUMN projects.type IS 'Project type: standard (full project) or goal (lightweight outcome with tasks, linked to entity, due date)';
