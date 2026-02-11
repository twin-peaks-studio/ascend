-- Activity Log
--
-- Append-only audit trail for project activity. Rows are written exclusively
-- by SECURITY DEFINER trigger functions — regular users only have SELECT.

-- ============================================================
-- Table
-- ============================================================

create table if not exists activity_log (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references projects(id) on delete cascade,
  task_id     uuid        references tasks(id) on delete set null,
  actor_id    uuid        references profiles(id) on delete set null,
  action      text        not null,
  details     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Primary feed query: newest first for a given project
create index activity_log_project_created_idx
  on activity_log (project_id, created_at desc);

-- Supports join to profiles for actor avatar/name
create index activity_log_actor_id_idx
  on activity_log (actor_id);

-- ============================================================
-- RLS
-- ============================================================

alter table activity_log enable row level security;

-- Users can view activity for projects they own or are members of
create policy "Users can view activity for accessible projects"
  on activity_log for select
  using (
    exists (
      select 1 from projects
      where projects.id = activity_log.project_id
      and (
        projects.created_by = auth.uid()
        or exists (
          select 1 from project_members
          where project_members.project_id = projects.id
          and project_members.user_id = auth.uid()
        )
      )
    )
  );

-- No INSERT/UPDATE/DELETE policies — only triggers write rows.

-- Grant SELECT to authenticated users (RLS filters the rest)
grant select on activity_log to authenticated;

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table activity_log;

-- ============================================================
-- Trigger: tasks (INSERT / UPDATE / DELETE)
-- ============================================================

create or replace function log_task_activity()
returns trigger as $$
declare
  v_project_id uuid;
  v_task_id    uuid;
begin
  -- Resolve IDs
  if TG_OP = 'DELETE' then
    v_project_id := OLD.project_id;
    v_task_id    := OLD.id;
  else
    v_project_id := NEW.project_id;
    v_task_id    := NEW.id;
  end if;

  -- Skip standalone tasks (no project)
  if v_project_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  -- INSERT -------------------------------------------------------
  if TG_OP = 'INSERT' then
    insert into activity_log (project_id, task_id, actor_id, action, details)
    values (
      v_project_id, v_task_id, auth.uid(), 'task_created',
      jsonb_build_object(
        'task_title', NEW.title,
        'status',     NEW.status,
        'priority',   NEW.priority
      )
    );

  -- UPDATE -------------------------------------------------------
  elsif TG_OP = 'UPDATE' then

    if NEW.status is distinct from OLD.status then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (
        v_project_id, v_task_id, auth.uid(), 'task_status_changed',
        jsonb_build_object(
          'task_title',  NEW.title,
          'old_status',  OLD.status,
          'new_status',  NEW.status
        )
      );
    end if;

    if NEW.priority is distinct from OLD.priority then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (
        v_project_id, v_task_id, auth.uid(), 'task_priority_changed',
        jsonb_build_object(
          'task_title',    NEW.title,
          'old_priority',  OLD.priority,
          'new_priority',  NEW.priority
        )
      );
    end if;

    if NEW.assignee_id is distinct from OLD.assignee_id then
      insert into activity_log (project_id, task_id, actor_id, action, details)
      values (
        v_project_id, v_task_id, auth.uid(), 'task_assigned',
        jsonb_build_object(
          'task_title',       NEW.title,
          'old_assignee_id',  OLD.assignee_id,
          'new_assignee_id',  NEW.assignee_id
        )
      );
    end if;

    return NEW;

  -- DELETE -------------------------------------------------------
  elsif TG_OP = 'DELETE' then
    insert into activity_log (project_id, task_id, actor_id, action, details)
    values (
      v_project_id, v_task_id, auth.uid(), 'task_deleted',
      jsonb_build_object('task_title', OLD.title)
    );

    return OLD;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger task_activity_trigger
  after insert or update or delete on tasks
  for each row
  execute function log_task_activity();

-- ============================================================
-- Trigger: comments (INSERT)
-- ============================================================

create or replace function log_comment_activity()
returns trigger as $$
declare
  v_project_id uuid;
begin
  -- Direct project comment
  if NEW.project_id is not null then
    v_project_id := NEW.project_id;
  -- Task comment — look up the task's project
  elsif NEW.task_id is not null then
    select project_id into v_project_id from tasks where id = NEW.task_id;
  end if;

  if v_project_id is null then return NEW; end if;

  insert into activity_log (project_id, task_id, actor_id, action, details)
  values (
    v_project_id,
    NEW.task_id,
    auth.uid(),
    'comment_added',
    jsonb_build_object('comment_preview', left(NEW.content, 100))
  );

  return NEW;
end;
$$ language plpgsql security definer;

create trigger comment_activity_trigger
  after insert on comments
  for each row
  execute function log_comment_activity();

-- ============================================================
-- Trigger: project_members (INSERT / DELETE)
-- ============================================================

create or replace function log_member_activity()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into activity_log (project_id, actor_id, action, details)
    values (
      NEW.project_id,
      NEW.invited_by,
      'member_added',
      jsonb_build_object('user_id', NEW.user_id)
    );
  elsif TG_OP = 'DELETE' then
    insert into activity_log (project_id, actor_id, action, details)
    values (
      OLD.project_id,
      auth.uid(),
      'member_removed',
      jsonb_build_object('user_id', OLD.user_id)
    );
  end if;

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$ language plpgsql security definer;

create trigger member_activity_trigger
  after insert or delete on project_members
  for each row
  execute function log_member_activity();

-- ============================================================
-- Trigger: projects (UPDATE — meaningful fields only)
-- ============================================================

create or replace function log_project_activity()
returns trigger as $$
declare
  v_changes     jsonb := '{}'::jsonb;
  v_has_changes boolean := false;
begin
  if NEW.title is distinct from OLD.title then
    v_changes := v_changes || jsonb_build_object('old_title', OLD.title, 'new_title', NEW.title);
    v_has_changes := true;
  end if;

  if NEW.status is distinct from OLD.status then
    v_changes := v_changes || jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status);
    v_has_changes := true;
  end if;

  if NEW.priority is distinct from OLD.priority then
    v_changes := v_changes || jsonb_build_object('old_priority', OLD.priority, 'new_priority', NEW.priority);
    v_has_changes := true;
  end if;

  if NEW.lead_id is distinct from OLD.lead_id then
    v_changes := v_changes || jsonb_build_object('old_lead_id', OLD.lead_id, 'new_lead_id', NEW.lead_id);
    v_has_changes := true;
  end if;

  if NEW.due_date is distinct from OLD.due_date then
    v_changes := v_changes || jsonb_build_object('old_due_date', OLD.due_date, 'new_due_date', NEW.due_date);
    v_has_changes := true;
  end if;

  if v_has_changes then
    v_changes := v_changes || jsonb_build_object('project_title', NEW.title);
    insert into activity_log (project_id, actor_id, action, details)
    values (NEW.id, auth.uid(), 'project_updated', v_changes);
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger project_activity_trigger
  after update on projects
  for each row
  execute function log_project_activity();
