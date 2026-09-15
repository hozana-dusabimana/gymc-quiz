-- Idempotent seed data.
--
-- Guarantees hozanadusabimana36@gmail.com exists as an ACTIVE choir LEADER, plus a
-- ready-to-use demo course, two demo choir members, three questions and one published
-- quiz so the quiz flow is testable immediately after any fresh deploy.
--
-- Every step is guarded, so re-running (every deploy applies pending migrations)
-- is a no-op. Editing seed content later needs a new migration file.

DO $$
DECLARE
  v_leader   uuid;
  v_member1  uuid;
  v_member2  uuid;
  v_course   uuid;
  v_course2  uuid;
  v_q1       uuid;
  v_q2       uuid;
  v_q3       uuid;
  v_quiz     uuid;
  v_pos      int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. The primary choir leader — hozanadusabimana36@gmail.com
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_leader FROM users WHERE lower(email) = 'hozanadusabimana36@gmail.com';
  IF v_leader IS NULL THEN
    INSERT INTO users (role, email, name, prefix, created_at)
    VALUES ('leader', 'hozanadusabimana36@gmail.com', 'Hozana Dusabimana', 'Bro.',
            now() - interval '1 year')          -- earliest -> sorts first everywhere
    RETURNING id INTO v_leader;
  ELSE
    UPDATE users
       SET role = 'leader', is_active = true,
           name = COALESCE(NULLIF(name, ''), 'Hozana Dusabimana')
     WHERE id = v_leader;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Demo choir members
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_member1 FROM users WHERE lower(email) = 'hozanadusabimana36+member@gmail.com';
  IF v_member1 IS NULL THEN
    INSERT INTO users (role, email, name, member_number)
    VALUES ('member', 'hozanadusabimana36+member@gmail.com', 'Demo Choir Member', 'GYMC/001')
    RETURNING id INTO v_member1;
  END IF;

  SELECT id INTO v_member2 FROM users WHERE lower(email) = 'hozanadusabimana36+member2@gmail.com';
  IF v_member2 IS NULL THEN
    INSERT INTO users (role, email, name, member_number)
    VALUES ('member', 'hozanadusabimana36+member2@gmail.com', 'Second Choir Member', 'GYMC/002')
    RETURNING id INTO v_member2;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Demo course + enrolments
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_course FROM courses
   WHERE leader_id = v_leader AND lower(code) = 'demo101';
  IF v_course IS NULL THEN
    INSERT INTO courses (code, title, description, department, term, leader_id, schedule, room)
    VALUES ('DEMO101', 'Music Theory Basics',
            'A short demo course: rhythm, pitch, and reading choral scores. Seeded so you can try the quiz flow straight away.',
            'Choir', '2026', v_leader, 'Sat 15:00', 'Choir Room')
    RETURNING id INTO v_course;
  END IF;

  INSERT INTO enrollments (course_id, member_id, source)
  VALUES (v_course, v_member1, 'seed'), (v_course, v_member2, 'seed')
  ON CONFLICT (course_id, member_id) DO NOTHING;

  SELECT id INTO v_course2 FROM courses
   WHERE leader_id = v_leader AND lower(code) = 'demo102';
  IF v_course2 IS NULL THEN
    INSERT INTO courses (code, title, description, department, term, leader_id, schedule, room)
    VALUES ('DEMO102', 'Sunday Service Hymns & Liturgy',
            'Repertoire and liturgy course covering the hymns and responses sung during Sunday worship service.',
            'Choir', '2026', v_leader, 'Sun 08:00', 'Sanctuary')
    RETURNING id INTO v_course2;
  END IF;

  INSERT INTO enrollments (course_id, member_id, source)
  VALUES (v_course2, v_member1, 'seed'), (v_course2, v_member2, 'seed')
  ON CONFLICT (course_id, member_id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 4. Questions
  -- ---------------------------------------------------------------------------
  -- Q1 — multiple choice
  SELECT id INTO v_q1 FROM questions
   WHERE course_id = v_course AND question_text = 'Which note value receives one full beat in 4/4 time?';
  IF v_q1 IS NULL THEN
    INSERT INTO questions (course_id, created_by, type, difficulty, question_text, correct_answer, marks, explanation)
    VALUES (v_course, v_leader, 'multiple_choice', 'Easy',
            'Which note value receives one full beat in 4/4 time?',
            'Quarter note', 2,
            'In 4/4 (common) time, the quarter note gets one beat and there are four beats per bar.')
    RETURNING id INTO v_q1;
    INSERT INTO question_options (question_id, position, content, is_correct) VALUES
      (v_q1, 0, 'Quarter note', true),
      (v_q1, 1, 'Half note',    false),
      (v_q1, 2, 'Whole note',   false),
      (v_q1, 3, 'Eighth note',  false);
  END IF;

  -- Q2 — true / false
  SELECT id INTO v_q2 FROM questions
   WHERE course_id = v_course AND question_text = 'A soprano is generally the lowest voice part in a mixed choir.';
  IF v_q2 IS NULL THEN
    INSERT INTO questions (course_id, created_by, type, difficulty, question_text, correct_answer, marks, explanation)
    VALUES (v_course, v_leader, 'true_false', 'Easy',
            'A soprano is generally the lowest voice part in a mixed choir.',
            'False', 1,
            'In a standard SATB choir, soprano is the highest voice part; bass is the lowest.')
    RETURNING id INTO v_q2;
    INSERT INTO question_options (question_id, position, content, is_correct) VALUES
      (v_q2, 0, 'True',  false),
      (v_q2, 1, 'False', true);
  END IF;

  -- Q3 — short answer (AI graded)
  SELECT id INTO v_q3 FROM questions
   WHERE course_id = v_course AND question_text = 'In one or two sentences, explain what dynamics markings (like piano and forte) tell a choir member and why they matter in worship singing.';
  IF v_q3 IS NULL THEN
    INSERT INTO questions (course_id, created_by, type, difficulty, question_text, correct_answer, marking_guidance, marks, explanation)
    VALUES (v_course, v_leader, 'short_answer', 'Medium',
            'In one or two sentences, explain what dynamics markings (like piano and forte) tell a choir member and why they matter in worship singing.',
            'Dynamics markings tell a singer how loud or soft to sing a passage (e.g. piano = soft, forte = loud). They matter because they shape the emotional and spiritual impact of a piece, helping the choir express the meaning of the text rather than singing everything at one volume.',
            '1 mark: correctly explains dynamics indicate volume/loudness. 1 mark: names at least one example (piano/forte or similar). Up to 2 further marks for explaining why it matters musically or spiritually.',
            4,
            'Dynamics shape expression and help a choir communicate the meaning and mood of a hymn or anthem.')
    RETURNING id INTO v_q3;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5. Published quiz
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_quiz FROM quizzes
   WHERE course_id = v_course AND title = 'Demo Quiz: Music Theory Basics';
  IF v_quiz IS NULL THEN
    INSERT INTO quizzes (course_id, created_by, title, description, duration_minutes, passing_score,
                         status, randomize_order, show_instant_feedback, attempts_allowed, published_at)
    VALUES (v_course, v_leader, 'Demo Quiz: Music Theory Basics',
            'Three quick questions covering rhythm, voice parts and dynamics. The short-answer question is graded by AI.',
            20, 50, 'published', false, true, 3, now())
    RETURNING id INTO v_quiz;

    v_pos := 0;
    INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES
      (v_quiz, v_q1, 0), (v_quiz, v_q2, 1), (v_quiz, v_q3, 2);
  END IF;
END $$;
