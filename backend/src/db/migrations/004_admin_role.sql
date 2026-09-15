-- Introduce a third role, 'admin'. Admins are the only ones who can create
-- leader (and other admin) accounts — leaders no longer self-register.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'leader', 'admin'));

-- Seed the one standing admin account (idempotent).
INSERT INTO users (role, email, name, password_hash, is_active)
SELECT 'admin', 'gymc@gmail.com', 'GYMC Admin', crypt('GYMC@123', gen_salt('bf')), true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'gymc@gmail.com');
