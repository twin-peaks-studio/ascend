-- Fix activity_log.task_id foreign key to SET NULL on delete
--
-- The original migration intended ON DELETE SET NULL but the constraint
-- was created without it (likely truncated during manual SQL execution).
-- This causes a 409 Conflict when deleting a task that has activity entries.

alter table activity_log
  drop constraint activity_log_task_id_fkey;

alter table activity_log
  add constraint activity_log_task_id_fkey
  foreign key (task_id) references tasks(id) on delete set null;
