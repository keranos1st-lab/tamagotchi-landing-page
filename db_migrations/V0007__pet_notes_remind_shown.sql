ALTER TABLE t_p91879943_tamagotchi_landing_p.pet_notes
    ADD COLUMN IF NOT EXISTS remind_shown_seq INTEGER NOT NULL DEFAULT 0;