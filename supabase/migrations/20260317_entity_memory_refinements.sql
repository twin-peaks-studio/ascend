-- Phase 4.5A: Memory Guidance — persistent user corrections for AI memory synthesis
ALTER TABLE entities ADD COLUMN memory_guidance TEXT;

-- Phase 4.5B: Source change detection — skip refresh when sources unchanged
ALTER TABLE entities ADD COLUMN memory_source_hash TEXT;
