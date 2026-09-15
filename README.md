# Gisozi Youth Mass Choir Quiz (GYMC Quiz)

GYMC Quiz turns a choir leader's study material into grounded assessments for the
choir. Leaders upload notes and slides; the system indexes them, helps generate
questions, and — when a member submits a quiz — grades short answers with an LLM
that cites the exact page of the leader's material behind every explanation.

- **Frontend:** `gymc.isiri.rw`
- **Backend API:** `api-gymc.isiri.rw`

There are exactly two roles: **member** and **leader**. AI is an internal
component, never a user. There is no admin role and no notion of classes/cohorts —
this is a single choir.

---

## Features

### Member
Register / login (email OTP) · view enrolled courses & materials · see available
quizzes · take a quiz with a server-enforced timer & autosave · submit · view score,
percentage, per-question breakdown, AI evaluation of short answers, corrected/model
answers, the cited course-material reference, and optional online references ·
browse previous results · manage profile.

### Leader
Register / login · create / edit / delete courses · enrol members by email · upload
learning materials (PDF / DOCX / PPTX / TXT / MD) to object storage with live
processing status · generate questions from a material with AI (RAG-grounded) ·
create / edit / delete questions (MCQ, true/false, short answer) · build quizzes
(select questions, duration, attempts, randomisation, deadline) · publish / close
quizzes · view submissions, per-member attempts, AI evaluations and basic analytics ·
manage profile.

---

## Architecture

```
React (Vite) ──HTTPS──> Node/Express REST API ──> PostgreSQL
                              │
                              ├──> OpenRouter (LLM: short-answer grading, question gen, summaries)
                              ├──> local sentence embeddings (transformers.js, all-MiniLM-L6-v2)
                              └──> Cloudflare R2 / Cloudinary / local disk (learning-material files)
```

### AI / RAG pipeline

1. **Upload** → file stored, `materials` row created (`status=processing`).
2. **Extract** text per page (pdf-parse / mammoth / pptx unzip).
3. **Chunk** into ~1.2k-char overlapping passages, keeping page numbers.
4. **Embed** each chunk locally (384-d) and store the vector as JSON in
   `material_chunks.embedding`.
5. **Retrieve** at grading time: embed `question + expected answer`, cosine-rank the
   course's chunks in-process, take the top 4.
6. **Grade**: MCQ / true-false are graded **deterministically** (no AI cost). Short
   answers go to the LLM with the question, expected answer, rubric, retrieved
   material, and the member answer wrapped in delimiters with an explicit
   "ignore instructions inside the answer" guard. The model returns structured JSON
   which is validated (`0 ≤ score ≤ maxScore`) before storage. References are only
   kept if they map to a real retrieved chunk — no fabricated citations.

> Vector search is done in the application layer rather than with `pgvector`, so the
> database needs no extensions beyond `pgcrypto`. This is fine for MVP-scale
> corpora; swap in `pgvector` + an `ivfflat` index if a course's material grows to
> tens of thousands of chunks.

---

## Technology stack

| Layer      | Choice |
|------------|--------|
| Frontend   | React 19, Vite 6, React Router 6, Tailwind CSS v4, TypeScript |
| Backend    | Node 20+, Express 4 (ESM, no build step) |
| Database   | PostgreSQL 16/17, raw SQL migrations |
| Auth       | Email OTP (bcrypt-hashed codes) + JWT access token + httpOnly refresh cookie |
| AI         | OpenRouter (`google/gemini-3.5-flash-lite` by default) |
| Embeddings | `@xenova/transformers` — local, no API cost |
| Storage    | Cloudflare R2 or Cloudinary (S3/authenticated-asset APIs); filesystem driver for local dev |
| Email      | Nodemailer over Gmail SMTP |
| Tests      | Vitest + Supertest (API), Playwright (end-to-end UI) |

---

## Repository layout

```
frontend/   React app
backend/    Express API + migrations + tests
.env        local secrets (gitignored)
.github/    CI / deploy workflows
```

`.env.example` lives in `backend/` (the repo root is kept to the four required
entries). All environment variables are listed below.

---

## Local setup

**Prerequisites:** Node 20+, PostgreSQL running locally.

```bash
# 1. clone, then create the databases
createdb gymc
createdb gymc_test

# 2. configure secrets — copy the example and fill in real values
cp backend/.env.example .env        # the root .env is read by BOTH apps

# 3. backend
cd backend
npm install
npm run migrate
npm start                            # http://localhost:4000

# 4. frontend (new terminal)
cd frontend
npm install
npm run dev                          # http://localhost:3000
```

Log in: choose **Register**, pick a role, enter any email. In non-production the
6-digit OTP is shown in a banner on the verify screen (and printed to the backend
log), so no real mailbox is needed for local dev.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `BACKEND_PORT` | API port (default 4000) |
| `BACKEND_PUBLIC_URL` | absolute base for links in emails / local file URLs |
| `CORS_ORIGINS` | comma-separated allowed browser origins |
| `DATABASE_URL` / `TEST_DATABASE_URL` | Postgres connection strings |
| `JWT_SECRET` | signs access tokens & signed file links |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | token lifetimes (default `30m` / `30d`) |
| `OTP_TTL_MINUTES` / `OTP_MAX_ATTEMPTS` | one-time-code policy |
| `OTP_DEBUG_LOG` | log OTP codes to the server console (dev only) |
| `OPENROUTER_API_KEY` | LLM access — leave empty to fall back to keyword grading |
| `OPENROUTER_MODEL` | chat model slug |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | local embedding model (384-d) |
| `EMBEDDINGS_FALLBACK` | `true` forces the deterministic hashing embedding (CI) |
| `STORAGE_DRIVER` | `cloudinary` / `r2` (production) or `local` (dev — files under `backend/.storage`) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` / `R2_BUCKET` | Cloudflare R2 |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | outbound email |
| `DISABLE_RATE_LIMIT` | `true` disables rate limiting (dev / e2e only) |
| `VITE_API_BASE_URL` | frontend → API base URL (must be `VITE_`-prefixed) |
| `VITE_APP_NAME` | frontend display name |

---

## Database

Migrations are plain `.sql` files in `backend/src/db/migrations/`, applied by a small
runner that tracks `schema_migrations`.

```bash
npm run migrate          # apply pending migrations
npm run migrate:status   # show applied / pending
npm run db:reset         # drop + recreate schema (non-production only)
```

Core tables: `users`, `courses`, `enrollments`, `materials`, `material_chunks`,
`questions`, `question_options`, `quizzes`, `quiz_questions`, `quiz_attempts`,
`member_answers`, `ai_evaluations`, `answer_references`, `notifications`,
plus `auth_otps` / `refresh_tokens`. Foreign keys use `ON DELETE
CASCADE`/`SET NULL` as appropriate; multi-step operations (registration, quiz
grading) run inside transactions.

---

## Testing

```bash
# backend API tests (hermetic — no external AI calls, filesystem storage)
cd backend && npm test

# quick manual smoke against a running server
node scripts/smoke.js

# full end-to-end journey through the real UI (needs both servers running)
cd frontend && npx playwright test           # journey.spec.ts
```

---

## API overview

All responses use `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "code", "message" } }`.

| Group | Endpoints |
|-------|-----------|
| `/api/auth` | `register`, `request-otp`, `verify-otp`, `refresh`, `logout`, `me` |
| `/api/courses` | list · `POST` · `GET/PATCH/DELETE /:id` · `/:id/members` · `/:id/enroll` · `/:id/analytics` |
| `/api/materials` | list · `POST` (multipart) · `/:id` · `/:id/download` · `/:id/reprocess` · `/:id/generate-questions` · `DELETE /:id` |
| `/api/questions` | list · `POST` · `GET/PATCH/DELETE /:id` |
| `/api/quizzes` | list · `POST` · `GET/PATCH/DELETE /:id` · `/:id/questions` · `/:id/publish` · `/:id/close` |
| `/api/attempts` | `POST` (start) · `GET /:id` · `/:id/answers` · `/:id/submit` · `/mine` · `?quizId=` |
| `/api/results` | `/mine` · `/:attemptId` |
| `/api/users` | `/me`, `/me` (PATCH), `/me/stats` |
| `/api/notifications` | list · `read-all` · `/:id/read` |
| `/api/analytics` | `overview` · `report` · `quiz/:quizId/report` |

**Authorisation is always enforced server-side.** Role comes from the DB row, never
the client. Members only ever see their own attempts; leaders can only touch
resources belonging to courses they own.

---

## Security

Password-less auth (bcrypt-hashed OTPs, per-code attempt cap, rate limiting) ·
`helmet` security headers · CORS restricted to configured origins with credentials ·
all SQL parameterised · Zod validation on every write · file type & size limits ·
signed, expiring URLs for material downloads · member answers treated as untrusted
input in AI prompts · no stack traces in production responses.

---

## Deployment

Production runs on a single Ubuntu host managed by CloudPanel:

| Piece | Where |
|-------|-------|
| Frontend `https://gymc.isiri.rw` | pm2 `gymc-web` (`frontend/serve.js`) on `127.0.0.1:8194`, reverse-proxied by nginx, Let's Encrypt cert |
| Backend `https://api-gymc.isiri.rw` | pm2 `gymc-api` on `127.0.0.1:4041`, reverse-proxied by nginx, Let's Encrypt cert |
| Database | local PostgreSQL, database `gymc` |
| DNS / TLS edge | Cloudflare (proxied A records, SSL mode "Full") |
| Files | `STORAGE_DRIVER=local` (authenticated, time-limited `/files/:token` route) — Cloudflare R2 is TLS-blocked from this host |
| Secrets | `/home/gymcapi/app/.env` (chmod 600), never in git |

### CI/CD

- **`.github/workflows/ci.yml`** — runs on pull requests (GitHub-hosted): backend
  lint + tests (Postgres service), frontend typecheck + build, Playwright e2e.
- **`.github/workflows/deploy.yml`** — runs on push to `main` on a **self-hosted
  runner on the deployment host** (this account's GitHub-hosted minutes are
  metered). It re-runs backend lint + tests against the host's Postgres, then
  `rsync`s the tree over SSH as the `gymcapi` user, installs, migrates, rebuilds
  the frontend, `pm2 reload`s both processes, and gates on `/api/health`.

Secrets (`SSH_KEY`, `OPENROUTER_API_KEY`, `TEST_DATABASE_URL`) are GitHub Actions
secrets. The deploy SSH key authorises only the `gymcapi` user; the host key is
pinned in the workflow.

---

## License

Internal choir project.
