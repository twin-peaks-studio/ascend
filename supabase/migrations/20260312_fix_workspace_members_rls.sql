-- Fix infinite recursion in workspace_members RLS policy
--
-- The existing RLS policy on workspace_members queries workspace_members
-- itself to check access, causing PostgreSQL error 42P17:
--   "infinite recursion detected in policy for relation workspace_members"
--
-- Fix: Drop the recursive policy and replace it with a simple policy that
-- uses auth.uid() directly — a user can see their own memberships.

-- Drop all existing policies on workspace_members to clear the recursive one
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where tablename = 'workspace_members'
      and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.workspace_members', pol.policyname);
  end loop;
end $$;

-- Ensure RLS is enabled
alter table public.workspace_members enable row level security;

-- Users can read their own memberships
create policy "Users can read own memberships"
  on public.workspace_members
  for select
  using (auth.uid() = user_id);

-- Users can insert memberships (for workspace creation — creator adds themselves)
create policy "Users can insert own memberships"
  on public.workspace_members
  for insert
  with check (auth.uid() = user_id);

-- Users can delete their own memberships (leave workspace)
create policy "Users can delete own memberships"
  on public.workspace_members
  for delete
  using (auth.uid() = user_id);

-- Workspace owners/admins can manage all memberships in their workspaces
-- This uses a subquery on workspaces (not workspace_members) to avoid recursion
create policy "Workspace owners can manage memberships"
  on public.workspace_members
  for all
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.created_by = auth.uid()
    )
  );

-- Also fix workspaces table RLS if needed
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where tablename = 'workspaces'
      and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.workspaces', pol.policyname);
  end loop;
end $$;

alter table public.workspaces enable row level security;

-- Users can read workspaces they created
create policy "Users can read own workspaces"
  on public.workspaces
  for select
  using (created_by = auth.uid());

-- Users can read workspaces they are members of (uses workspace_members which is now safe)
create policy "Members can read workspaces"
  on public.workspaces
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
    )
  );

-- Users can create workspaces
create policy "Users can create workspaces"
  on public.workspaces
  for insert
  with check (auth.uid() = created_by);

-- Creators can update their workspaces
create policy "Creators can update workspaces"
  on public.workspaces
  for update
  using (created_by = auth.uid());

-- Creators can delete their workspaces
create policy "Creators can delete workspaces"
  on public.workspaces
  for delete
  using (created_by = auth.uid());
