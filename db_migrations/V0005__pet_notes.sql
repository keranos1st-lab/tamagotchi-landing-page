CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.pet_notes (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p91879943_tamagotchi_landing_p.users(id),
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1800),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pet_notes_owner_updated ON t_p91879943_tamagotchi_landing_p.pet_notes(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS pet_notes_text_search ON t_p91879943_tamagotchi_landing_p.pet_notes USING GIN(to_tsvector('russian',text));
CREATE TABLE IF NOT EXISTS t_p91879943_tamagotchi_landing_p.pet_note_requests (
    user_id INTEGER NOT NULL REFERENCES t_p91879943_tamagotchi_landing_p.users(id),
    request_id VARCHAR(96) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS pet_note_requests_owner_time ON t_p91879943_tamagotchi_landing_p.pet_note_requests(user_id,created_at);