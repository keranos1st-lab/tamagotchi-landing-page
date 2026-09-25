CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.ai_requests (
    id BIGSERIAL PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind VARCHAR(16) NOT NULL DEFAULT 'chat',
    status VARCHAR(24) NOT NULL DEFAULT 'ok',
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    cost NUMERIC(12,6) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_requests_client_time ON t_p91879943_tamagotchi_landing_p.ai_requests (client_id, created_at);
CREATE INDEX IF NOT EXISTS ai_requests_ip_time ON t_p91879943_tamagotchi_landing_p.ai_requests (ip, created_at);
CREATE INDEX IF NOT EXISTS ai_requests_time ON t_p91879943_tamagotchi_landing_p.ai_requests (created_at);