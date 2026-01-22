-- Create audit_logs table for security tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id TEXT,
  resource_id TEXT,
  access_granted BOOLEAN NOT NULL,
  ip_address TEXT,
  details TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_timestamp_idx ON audit_logs(timestamp);
