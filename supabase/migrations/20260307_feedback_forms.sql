-- Feedback Forms Feature Migration
-- Adds feedback_forms and feedback_submissions tables.
-- Extends tasks table with feedback tracking columns.
-- All tester-facing writes go through the service role (bypasses RLS);
-- authenticated RLS policies cover developer-facing reads/writes.

-- ─── 1. feedback_forms ───────────────────────────────────────────────────────

create table if not exists feedback_forms (
  id               uuid        primary key default gen_random_uuid(),
  project_id       uuid        references projects(id) on delete cascade not null,
  title            text        not null,
  slug             text        unique not null,
  password_hash    text        not null,
  password_version integer     not null default 1,
  fields           jsonb       not null default '[]'::jsonb,
  ai_builder_history jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists feedback_forms_project_id_idx on feedback_forms(project_id);
create index if not exists feedback_forms_slug_idx       on feedback_forms(slug);

-- ─── 2. feedback_submissions ─────────────────────────────────────────────────
-- Note: task_id references tasks (already exists).
-- tasks.feedback_submission_id references this table (added below).

create table if not exists feedback_submissions (
  id                  uuid        primary key default gen_random_uuid(),
  form_id             uuid        references feedback_forms(id) on delete cascade not null,
  raw_contents        jsonb       not null,
  followup_transcript jsonb,
  final_contents      jsonb,
  task_id             uuid        references tasks(id) on delete set null,
  submitted_at        timestamptz not null default now(),
  followup_complete   boolean     not null default false
);

create index if not exists feedback_submissions_form_id_idx  on feedback_submissions(form_id);
create index if not exists feedback_submissions_task_id_idx  on feedback_submissions(task_id);

-- ─── 3. Extend tasks table ────────────────────────────────────────────────────
-- 3a. Add reverse FK from tasks back to feedback_submissions.
alter table tasks
  add column if not exists feedback_submission_id uuid references feedback_submissions(id) on delete set null;

create index if not exists tasks_feedback_submission_id_idx on tasks(feedback_submission_id);

-- 3b. Extend source_type to include 'feedback_form'.
--     The inline CHECK constraint from 20260203 is named tasks_source_type_check.
alter table tasks drop constraint if exists tasks_source_type_check;
alter table tasks
  add constraint tasks_source_type_check
  check (source_type in ('manual', 'ai_extraction', 'feedback_form'));

comment on column tasks.source_type is
  'How the task was created: manual (default), ai_extraction, or feedback_form';
comment on column tasks.feedback_submission_id is
  'FK to feedback_submissions — set when source_type = ''feedback_form''';

-- ─── 4. RLS — feedback_forms ─────────────────────────────────────────────────

alter table feedback_forms enable row level security;

-- Reusable helper: user is project owner or member
create policy "Project members can view feedback forms"
  on feedback_forms for select
  using (
    exists (
      select 1 from projects
      where projects.id = feedback_forms.project_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = feedback_forms.project_id
        and project_members.user_id = auth.uid()
    )
  );

create policy "Project members can create feedback forms"
  on feedback_forms for insert
  with check (
    exists (
      select 1 from projects
      where projects.id = feedback_forms.project_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = feedback_forms.project_id
        and project_members.user_id = auth.uid()
    )
  );

create policy "Project members can update feedback forms"
  on feedback_forms for update
  using (
    exists (
      select 1 from projects
      where projects.id = feedback_forms.project_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = feedback_forms.project_id
        and project_members.user_id = auth.uid()
    )
  );

create policy "Project members can delete feedback forms"
  on feedback_forms for delete
  using (
    exists (
      select 1 from projects
      where projects.id = feedback_forms.project_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = feedback_forms.project_id
        and project_members.user_id = auth.uid()
    )
  );

-- ─── 5. RLS — feedback_submissions ───────────────────────────────────────────
-- INSERT and UPDATE are performed exclusively by the service role (tester API routes).
-- SELECT and DELETE are available to authenticated project members.

alter table feedback_submissions enable row level security;

create policy "Project members can view feedback submissions"
  on feedback_submissions for select
  using (
    exists (
      select 1 from feedback_forms
      join projects on projects.id = feedback_forms.project_id
      where feedback_forms.id = feedback_submissions.form_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from feedback_forms
      join project_members on project_members.project_id = feedback_forms.project_id
      where feedback_forms.id = feedback_submissions.form_id
        and project_members.user_id = auth.uid()
    )
  );

create policy "Project members can delete feedback submissions"
  on feedback_submissions for delete
  using (
    exists (
      select 1 from feedback_forms
      join projects on projects.id = feedback_forms.project_id
      where feedback_forms.id = feedback_submissions.form_id
        and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from feedback_forms
      join project_members on project_members.project_id = feedback_forms.project_id
      where feedback_forms.id = feedback_submissions.form_id
        and project_members.user_id = auth.uid()
    )
  );

-- ─── 6. updated_at triggers ───────────────────────────────────────────────────

create or replace function update_feedback_forms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_feedback_forms_updated_at_trigger
  before update on feedback_forms
  for each row
  execute function update_feedback_forms_updated_at();

-- ─── 7. Grants ────────────────────────────────────────────────────────────────

grant select, insert, update, delete on feedback_forms       to authenticated;
grant select,                   delete on feedback_submissions to authenticated;
-- INSERT and UPDATE on feedback_submissions intentionally withheld from authenticated;
-- only the service role (used in tester API routes) may write submissions.
