-- Notifications System Migration
-- Phase 3, Item #17: @Mentions and Notifications
--
-- NOTE: This migration has already been run manually in the Supabase SQL editor.
-- This file exists for version control tracking only.

-- Create notifications table
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade not null,
  type text not null default 'mention',
  comment_id uuid references comments(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_created_at_idx on notifications(created_at desc);
create index if not exists notifications_unread_idx on notifications(user_id, read) where read = false;

-- RLS
alter table notifications enable row level security;

create policy "Users can read own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Authenticated users can create notifications"
  on notifications for insert
  with check (auth.uid() is not null);

create policy "Users can update own notifications"
  on notifications for update
  using (user_id = auth.uid());

create policy "Users can delete own notifications"
  on notifications for delete
  using (user_id = auth.uid());

-- Grant permissions
grant select, insert, update, delete on notifications to authenticated;

-- Enable Realtime
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table comments;
