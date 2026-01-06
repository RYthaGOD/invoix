-- Webhook System Migration
-- Enterprise Oracle Integration for B2B invoicing

-- Webhooks table: Registered webhook endpoints
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_wallet TEXT NOT NULL,
    
    -- Endpoint Configuration
    name TEXT,
    url TEXT NOT NULL,
    
    -- Security (SCRYPT hash of the secret)
    secret_hash TEXT NOT NULL,
    
    -- Event Subscriptions (PostgreSQL array)
    events TEXT[] NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    
    -- Health Tracking
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_delivery_at TIMESTAMP,
    last_delivery_status TEXT,
    last_error_message TEXT,
    
    -- Auto-disable configuration
    max_retries INTEGER NOT NULL DEFAULT 5,
    auto_disable_threshold INTEGER NOT NULL DEFAULT 10,
    
    -- Metadata
    description TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_owner_wallet ON webhooks(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);

-- Webhook Deliveries table: Individual delivery attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    
    -- Event Details
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    
    -- Delivery Status
    status TEXT NOT NULL DEFAULT 'pending',
    
    -- Retry Tracking
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_attempt_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    
    -- Response Details
    response_code INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error Details
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMP
);

-- Indexes for webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);

-- Comment for documentation
COMMENT ON TABLE webhooks IS 'Enterprise webhook endpoints for ERP/accounting integration';
COMMENT ON TABLE webhook_deliveries IS 'Individual webhook delivery attempts with retry tracking';
