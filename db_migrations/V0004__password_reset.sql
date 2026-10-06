CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.password_resets (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p91879943_tamagotchi_landing_p.users(id),
    email VARCHAR(254) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_resets_email_open ON t_p91879943_tamagotchi_landing_p.password_resets (email, closed_at);
CREATE INDEX IF NOT EXISTS password_resets_user ON t_p91879943_tamagotchi_landing_p.password_resets (user_id);

CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.password_reset_requests (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_requests_email_time ON t_p91879943_tamagotchi_landing_p.password_reset_requests (email, created_at);
CREATE INDEX IF NOT EXISTS password_reset_requests_ip_time ON t_p91879943_tamagotchi_landing_p.password_reset_requests (ip, created_at);
