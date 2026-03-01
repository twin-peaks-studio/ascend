-- Sections Feature Migration
-- Adds project-scoped sections for task grouping in list view

-- 1. Create sections table
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes for sections
create index if not exists sections_project_id_idx on sections(project_id);
create index if not exists sections_project_position_idx on sections(project_id, position);

-- 3. Add section fields to tasks
alter table tasks add column if not exists section_id uuid references sections(id) on delete set null;
alter table tasks add column if not exists section_position integer not null default 0;

create index if not exists tasks_section_id_idx on tasks(section_id);
create index if not exists tasks_section_position_idx on tasks(section_id, section_position);

-- 4. RLS Policies for sections (mirrors project access pattern from comments migration)
alter table sections enable row level security;

-- Select: users who are project owner or member
create policy "Users can view sections in their projects"
  on sections for select
  using (
    exists (
      select 1 from projects
      where projects.id = sections.project_id
      and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = sections.project_id
      and project_members.user_id = auth.uid()
    )
  );

-- Insert: project owner or member can create sections
create policy "Users can create sections in their projects"
  on sections for insert
  with check (
    exists (
      select 1 from projects
      where projects.id = sections.project_id
      and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = sections.project_id
      and project_members.user_id = auth.uid()
    )
  );

-- Update: project owner or member
create policy "Users can update sections in their projects"
  on sections for update
  using (
    exists (
      select 1 from projects
      where projects.id = sections.project_id
      and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = sections.project_id
      and project_members.user_id = auth.uid()
    )
  );

-- Delete: project owner or member
create policy "Users can delete sections in their projects"
  on sections for delete
  using (
    exists (
      select 1 from projects
      where projects.id = sections.project_id
      and projects.created_by = auth.uid()
    )
    or exists (
      select 1 from project_members
      where project_members.project_id = sections.project_id
      and project_members.user_id = auth.uid()
    )
  );

-- 5. Auto-update updated_at trigger
create or replace function update_sections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_sections_updated_at_trigger
  before update on sections
  for each row
  execute function update_sections_updated_at();

-- 6. Grant permissions
grant select, insert, update, delete on sections to authenticated;

-- 7. Enable realtime for sections
alter publication supabase_realtime add table sections;
