-- Enable Realtime on time_entries table
-- This allows cross-tab and cross-device synchronization of timer state
-- Any INSERT, UPDATE, or DELETE on time_entries will broadcast to subscribed clients

ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;
