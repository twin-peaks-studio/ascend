-- Activity Log Improvements
--
-- 1. Add notes trigger (create/update/delete)
-- 2. Update member trigger to resolve display names from profiles
-- 3. Update project trigger to store more descriptive before/after values

-- ============================================================
-- Trigger: notes (INSERT / UPDATE / DELETE)
-- ============================================================

create or replace function log_note_activity()
returns trigger as $$
declare
  v_project_id uuid;
begin
  -- Resolve project_id
  if TG_OP = 'DELETE' then
    v_project_id := OLD.project_id;
  else
    v_project_id := NEW.project_id;
  end if;

  -- Skip notes without a project
  if v_project_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  -- INSERT -------------------------------------------------------
  if TG_OP = 'INSERT' then
    insert into activity_log (project_id, actor_id, action, details)
    values (
      v_project_id, auth.uid(), 'note_created',
      jsonb_build_object(
        'note_id',    NEW.id,
        'note_title', NEW.title
      )
    );

  -- UPDATE -------------------------------------------------------
  elsif TG_OP = 'UPDATE' then
    -- Only log if title or content actually changed
    if NEW.title is distinct from OLD.title or NEW.content is distinct from OLD.content then
      insert into activity_log (project_id, actor_id, action, details)
      values (
        v_project_id, auth.uid(), 'note_updated',
        jsonb_build_object(
          'note_id',    NEW.id,
          'note_title', NEW.title
        )
      );
    end if;

  -- DELETE -------------------------------------------------------
  elsif TG_OP = 'DELETE' then
    insert into activity_log (project_id, actor_id, action, details)
    values (
      v_project_id, auth.uid(), 'note_deleted',
      jsonb_build_object(
        'note_id',    OLD.id,
        'note_title', OLD.title
      )
    );

    return OLD;
  end if;

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$ language plpgsql security definer;

create trigger note_activity_trigger
  after insert or update or delete on notes
  for each row
  execute function log_note_activity();

-- ============================================================
-- Updated Trigger: project_members — resolve member display name
-- ============================================================

create or replace function log_member_activity()
returns trigger as $$
declare
  v_member_name text;
begin
  if TG_OP = 'INSERT' then
    -- Look up the added member's display name
    select coalesce(display_name, email, 'Unknown')
      into v_member_name
      from profiles
      where id = NEW.user_id;

    insert into activity_log (project_id, actor_id, action, details)
    values (
      NEW.project_id,
      NEW.invited_by,
      'member_added',
      jsonb_build_object('user_id', NEW.user_id, 'member_name', v_member_name)
    );
  elsif TG_OP = 'DELETE' then
    -- Look up the removed member's display name
    select coalesce(display_name, email, 'Unknown')
      into v_member_name
      from profiles
      where id = OLD.user_id;

    insert into activity_log (project_id, actor_id, action, details)
    values (
      OLD.project_id,
      auth.uid(),
      'member_removed',
      jsonb_build_object('user_id', OLD.user_id, 'member_name', v_member_name)
    );
  end if;

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Updated Trigger: projects — include before/after display values
-- ============================================================

create or replace function log_project_activity()
returns trigger as $$
declare
  v_changes     jsonb := '{}'::jsonb;
  v_has_changes boolean := false;
  v_old_lead_name text;
  v_new_lead_name text;
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
    -- Resolve lead display names
    if OLD.lead_id is not null then
      select coalesce(display_name, email, 'Unknown') into v_old_lead_name from profiles where id = OLD.lead_id;
    end if;
    if NEW.lead_id is not null then
      select coalesce(display_name, email, 'Unknown') into v_new_lead_name from profiles where id = NEW.lead_id;
    end if;
    v_changes := v_changes || jsonb_build_object(
      'old_lead_id', OLD.lead_id,
      'new_lead_id', NEW.lead_id,
      'old_lead_name', coalesce(v_old_lead_name, 'None'),
      'new_lead_name', coalesce(v_new_lead_name, 'None')
    );
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
