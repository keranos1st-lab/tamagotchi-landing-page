ALTER TABLE t_p91879943_tamagotchi_landing_p.pet_notes
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS remind_lead INTEGER CHECK (remind_lead IN (0, 15, 30)),
    ADD COLUMN IF NOT EXISTS remind_tz VARCHAR(64),
    ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS remind_state VARCHAR(8) CHECK (remind_state IN ('active', 'done')),
    ADD COLUMN IF NOT EXISTS remind_seq INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS remind_done_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS pet_notes_remind_due ON t_p91879943_tamagotchi_landing_p.pet_notes(user_id, remind_at) WHERE remind_state = 'active';