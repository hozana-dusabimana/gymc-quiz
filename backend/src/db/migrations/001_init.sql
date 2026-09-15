-- Gisozi Youth Mass Choir Quiz (GYMC Quiz) — initial schema
-- Embeddings are stored as jsonb float arrays and compared with cosine similarity
-- in the application layer (see src/lib/rag.js). This keeps local dev and server
-- deployment free of the pgvector extension; it is fine for MVP-scale corpora.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role            text NOT NULL CHECK (role IN ('member', 'leader')),
  email           text NOT NULL,
  name            text NOT NULL,
  phone           text,
  prefix          text,
  avatar_url      text,
  member_number   text,
  password_hash   text,               -- optional; OTP is the primary factor
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- auth: one-time passcodes + refresh tokens
-- ---------------------------------------------------------------------------
CREATE TABLE auth_otps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  code_hash    text NOT NULL,
  purpose      text NOT NULL DEFAULT 'login',
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  attempts     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_otps_email_idx ON auth_otps (lower(email), created_at DESC);

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  user_agent   text,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- courses + enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  department       text NOT NULL DEFAULT '',
  term             text NOT NULL DEFAULT '',
  leader_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credits          numeric,
  campus           text,
  schedule         text NOT NULL DEFAULT '',
  room             text NOT NULL DEFAULT '',
  color            text NOT NULL DEFAULT 'from-blue-600 to-indigo-700',
  start_date       date,
  end_date         date,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX courses_leader_code_idx ON courses (leader_id, lower(code));
CREATE INDEX courses_leader_idx ON courses (leader_id);
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, member_id)
);
CREATE INDEX enrollments_member_idx ON enrollments (member_id);

-- ---------------------------------------------------------------------------
-- materials + chunks (RAG corpus)
-- ---------------------------------------------------------------------------
CREATE TABLE materials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  uploaded_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  title          text NOT NULL,
  filename       text NOT NULL,
  file_type      text NOT NULL,
  file_size      bigint NOT NULL DEFAULT 0,
  storage_key    text NOT NULL,
  storage_url    text,
  page_count     int NOT NULL DEFAULT 0,
  chunk_count    int NOT NULL DEFAULT 0,
  summary        text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'uploading'
                   CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX materials_course_idx ON materials (course_id);
CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE material_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  chunk_index   int NOT NULL,
  content       text NOT NULL,
  page_number   int,
  token_estimate int NOT NULL DEFAULT 0,
  embedding     jsonb,               -- float[] as JSON; NULL until embedded
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, chunk_index)
);
CREATE INDEX material_chunks_course_idx ON material_chunks (course_id);
CREATE INDEX material_chunks_material_idx ON material_chunks (material_id);

-- ---------------------------------------------------------------------------
-- questions + options
-- ---------------------------------------------------------------------------
CREATE TABLE questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  created_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  type              text NOT NULL CHECK (type IN ('multiple_choice', 'true_false', 'short_answer')),
  difficulty        text NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question_text     text NOT NULL,
  correct_answer    text NOT NULL DEFAULT '',   -- MCQ/TF: canonical option text; short_answer: model answer
  marking_guidance  text NOT NULL DEFAULT '',
  marks             int NOT NULL DEFAULT 1 CHECK (marks > 0),
  explanation       text NOT NULL DEFAULT '',
  material_id       uuid REFERENCES materials (id) ON DELETE SET NULL,
  material_page     int,
  tags              text[] NOT NULL DEFAULT '{}',
  ai_generated      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_course_idx ON questions (course_id);
CREATE TRIGGER questions_set_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE question_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  position     int NOT NULL,
  content      text NOT NULL,
  is_correct   boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, position)
);
CREATE INDEX question_options_question_idx ON question_options (question_id);

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------
CREATE TABLE quizzes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id             uuid NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  created_by            uuid REFERENCES users (id) ON DELETE SET NULL,
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  duration_minutes      int NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  passing_score         int NOT NULL DEFAULT 50 CHECK (passing_score BETWEEN 0 AND 100),
  opens_at              timestamptz,
  deadline              timestamptz,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  randomize_order       boolean NOT NULL DEFAULT false,
  show_instant_feedback boolean NOT NULL DEFAULT false,
  attempts_allowed      int NOT NULL DEFAULT 1 CHECK (attempts_allowed > 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz
);
CREATE INDEX quizzes_course_idx ON quizzes (course_id);
CREATE TRIGGER quizzes_set_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quiz_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  position       int NOT NULL,
  marks_override int,
  UNIQUE (quiz_id, question_id),
  UNIQUE (quiz_id, position)
);

-- ---------------------------------------------------------------------------
-- attempts + answers + AI evaluations + references
-- ---------------------------------------------------------------------------
CREATE TABLE quiz_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id           uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  member_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  attempt_number    int NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'submitted', 'evaluating', 'completed', 'failed')),
  question_order    jsonb NOT NULL DEFAULT '[]',
  started_at        timestamptz NOT NULL DEFAULT now(),
  must_submit_by    timestamptz NOT NULL,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  score             numeric,
  max_score         numeric,
  percentage        numeric,
  time_spent_seconds int,
  ai_summary        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, member_id, attempt_number)
);
CREATE INDEX quiz_attempts_member_idx ON quiz_attempts (member_id);
CREATE INDEX quiz_attempts_quiz_idx ON quiz_attempts (quiz_id);

CREATE TABLE member_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id          uuid NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  answer_text         text NOT NULL DEFAULT '',
  selected_option_id  uuid REFERENCES question_options (id) ON DELETE SET NULL,
  is_correct          boolean,
  score               numeric,
  max_score           numeric,
  graded_by           text CHECK (graded_by IN ('auto', 'ai')),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX member_answers_attempt_idx ON member_answers (attempt_id);
CREATE TRIGGER member_answers_set_updated_at BEFORE UPDATE ON member_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ai_evaluations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_answer_id  uuid NOT NULL UNIQUE REFERENCES member_answers (id) ON DELETE CASCADE,
  attempt_id        uuid NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  question_id       uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  score             numeric NOT NULL,
  max_score         numeric NOT NULL,
  evaluation        text NOT NULL DEFAULT '',
  feedback          text NOT NULL DEFAULT '',
  correct_answer    text NOT NULL DEFAULT '',
  model             text,
  raw_response      jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_evaluations_attempt_idx ON ai_evaluations (attempt_id);

CREATE TABLE answer_references (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_answer_id   uuid NOT NULL REFERENCES member_answers (id) ON DELETE CASCADE,
  kind               text NOT NULL DEFAULT 'material' CHECK (kind IN ('material', 'online')),
  material_id        uuid REFERENCES materials (id) ON DELETE SET NULL,
  title              text NOT NULL,
  page_number        int,
  snippet            text NOT NULL DEFAULT '',
  url                text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX answer_references_answer_idx ON answer_references (member_answer_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        text NOT NULL,
  message      text NOT NULL DEFAULT '',
  type         text NOT NULL DEFAULT 'system' CHECK (type IN ('quiz', 'grade', 'material', 'system')),
  link_target  text,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
