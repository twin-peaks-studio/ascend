-- Comments System Migration
-- Phase 3, Item #16: Comments on tasks and projects

-- Create comments table
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure comment belongs to either a task or project (not both, not neither)
  constraint check_has_parent check (
    (task_id is not null and project_id is null) or
    (task_id is null and project_id is not null)
  )
);

-- Indexes for performance
create index if not exists comments_task_id_idx on comments(task_id);
create index if not exists comments_project_id_idx on comments(project_id);
create index if not exists comments_author_id_idx on comments(author_id);
create index if not exists comments_created_at_idx on comments(created_at desc);

-- RLS Policies
alter table comments enable row level security;

-- Users can view comments on tasks they have access to
create policy "Users can view comments in their team"
  on comments for select
  using (
    -- Comments on tasks the user can access
    exists (
      select 1 from tasks
      where tasks.id = comments.task_id
      and (
        -- User created the task
        tasks.created_by = auth.uid()
        or
        -- User is assigned to the task
        tasks.assignee_id = auth.uid()
        or
        -- User has access to the project
        exists (
          select 1 from project_members
          where project_members.project_id = tasks.project_id
          and project_members.user_id = auth.uid()
        )
        or
        -- User created the project
        exists (
          select 1 from projects
          where projects.id = tasks.project_id
          and projects.created_by = auth.uid()
        )
      )
    )
    or
    -- Comments on projects the user can access
    exists (
      select 1 from projects
      where projects.id = comments.project_id
      and (
        -- User created the project
        projects.created_by = auth.uid()
        or
        -- User is a member of the project
        exists (
          select 1 from project_members
          where project_members.project_id = projects.id
          and project_members.user_id = auth.uid()
        )
      )
    )
  );

-- Users can create comments on tasks/projects they have access to
create policy "Users can create comments on accessible items"
  on comments for insert
  with check (
    author_id = auth.uid()
    and
    (
      -- Comment on task user has access to
      exists (
        select 1 from tasks
        where tasks.id = comments.task_id
        and (
          tasks.created_by = auth.uid()
          or tasks.assignee_id = auth.uid()
          or exists (
            select 1 from project_members
            where project_members.project_id = tasks.project_id
            and project_members.user_id = auth.uid()
          )
          or exists (
            select 1 from projects
            where projects.id = tasks.project_id
            and projects.created_by = auth.uid()
          )
        )
      )
      or
      -- Comment on project user has access to
      exists (
        select 1 from projects
        where projects.id = comments.project_id
        and (
          projects.created_by = auth.uid()
          or exists (
            select 1 from project_members
            where project_members.project_id = projects.id
            and project_members.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Users can update their own comments
create policy "Users can update their own comments"
  on comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Users can delete their own comments
create policy "Users can delete their own comments"
  on comments for delete
  using (author_id = auth.uid());

-- Function to update updated_at timestamp
create or replace function update_comments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger update_comments_updated_at_trigger
  before update on comments
  for each row
  execute function update_comments_updated_at();

-- Grant permissions
grant select, insert, update, delete on comments to authenticated;
