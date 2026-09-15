-- Switch from OTP-only login to password-based login (email or phone + password).
-- Backfill the seeded demo accounts (created by 002_seed.sql before this change,
-- so they have no password yet) with a known default password — crypt() needs
-- pgcrypto, already enabled in 001_init.sql. Anyone using this default in
-- production should change it from Profile after first login.
UPDATE users
   SET password_hash = crypt('Gymc@2026', gen_salt('bf'))
 WHERE password_hash IS NULL;

-- Phone doubles as a login identifier alongside email, so it must be unique
-- among accounts that have one.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users (phone) WHERE phone IS NOT NULL AND phone <> '';
