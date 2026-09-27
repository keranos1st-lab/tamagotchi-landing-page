CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p91879943_tamagotchi_landing_p.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user ON t_p91879943_tamagotchi_landing_p.sessions (user_id);

CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.auth_attempts (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    ok BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_attempts_email_time ON t_p91879943_tamagotchi_landing_p.auth_attempts (email, created_at);
CREATE INDEX IF NOT EXISTS auth_attempts_ip_time ON t_p91879943_tamagotchi_landing_p.auth_attempts (ip, created_at);

CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.user_state (
    user_id INTEGER PRIMARY KEY REFERENCES t_p91879943_tamagotchi_landing_p.users(id),
    pet JSONB,
    achievements JSONB,
    memory JSONB,
    rev INTEGER NOT NULL DEFAULT 0,
    client_updated_at BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);