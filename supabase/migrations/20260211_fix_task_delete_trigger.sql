-- Fix task deletion: the AFTER DELETE trigger tries to INSERT into activity_log
-- with task_id referencing the just-deleted task, causing an FK violation.
--
-- Fix 1: Set task_id to NULL in the DELETE branch of the trigger (the task
--         title is already preserved in the details JSONB).
-- Fix 2: Ensure the FK uses ON DELETE SET NULL for any future edge cases.

-- Recreate FK with ON DELETE SET NULL
alter table activity_log
  drop constraint if exists activity_log_task_id_fkey;

alter table activity_log
  add constraint activity_log_task_id_fkey
  foreign key (task_id) references tasks(id) on delete set null;

-- Fix the trigger: use NULL for task_id in the DELETE branch
create or replace function log_task_activity()
returns trigger as $$
declare
  v_project_id uuid;
  v_task_id    uuid;
begin
  if TG_OP = 'DELETE' then
    v_project_id := OLD.project_id;
    v_task_id    := OLD.id;
  else
    v_project_id := NEW.project_id;
    v_task_id    := NEW.id;
  end if;

  if v_project_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  if TG_OP = 'INSERT' then
    insert into activity_log (project_id, task_id, actor_id, action, details)
    values (v_project_id, v_task_id, auth.uid(), 'task_created',
      jsonb_build_object('task_title', NEW.title, 'status', NEW.status, 'priority', NEW.priority));

  elsif TG_OP = 'UPDATE' then
    if NEW.status is distinct from OLD.status then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (v_project_id, v_task_id, auth.uid(), 'task_status_changed',
        jsonb_build_object('task_title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status));
    end if;
    if NEW.priority is distinct from OLD.priority then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (v_project_id, v_task_id, auth.uid(), 'task_priority_changed',
        jsonb_build_object('task_title', NEW.title, 'old_priority', OLD.priority, 'new_priority', NEW.priority));
    end if;
    if NEW.assignee_id is distinct from OLD.assignee_id then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (v_project_id, v_task_id, auth.uid(), 'task_assigned',
        jsonb_build_object('task_title', NEW.title, 'old_assignee_id', OLD.assignee_id, 'new_assignee_id', NEW.assignee_id));
    end if;
    return NEW;

  elsif TG_OP = 'DELETE' then
    -- Use NULL for task_id since the task row is already gone (AFTER DELETE).
    -- The task title is preserved in the details JSONB.
    insert into activity_log (project_id, task_id, actor_id, action, details)
    values (v_project_id, NULL, auth.uid(), 'task_deleted',
      jsonb_build_object('task_title', OLD.title));
    return OLD;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;
