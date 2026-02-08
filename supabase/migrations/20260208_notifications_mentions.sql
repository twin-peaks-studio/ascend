-- Notifications & Mentions System
-- Enables @mentions in comments and notification delivery

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User who receives the notification
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Type of notification
  type text NOT NULL CHECK (type IN ('mention', 'comment', 'task_assigned', 'task_completed', 'project_update')),

  -- Entity that triggered the notification (task, project, comment, etc.)
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'project', 'comment', 'note')),
  entity_id uuid NOT NULL,

  -- User who triggered the notification (e.g., person who @mentioned you)
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Notification message/content
  message text NOT NULL,

  -- Read status
  read boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,

  -- Indexes for efficient queries
  CONSTRAINT notifications_user_id_created_at_idx PRIMARY KEY (id),
  INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC),
  INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false
);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can create notifications (will be done via API route)
CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE notifications IS 'User notifications for mentions, assignments, and activity updates';

-- Grant necessary permissions
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT INSERT ON notifications TO service_role;
