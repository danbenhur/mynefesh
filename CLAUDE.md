# MyNefesh — CLAUDE.md

> This file is the authoritative briefing for every Claude Code session.
> Read it fully before touching any code.

---

## Vision

MyNefesh is a personal life-management system — a 24/7 loyal AI secretary that knows Dan deeply, tracks every area of his life, and proactively surfaces what matters before he has to ask.

The core promise: **a clear, real-time picture of where Dan stands across every life domain, with visible, granular improvement over time.**

This is not a todo app. It is not a journal. It is an intelligent, proactive life companion built around Dan's personal structure of life ("Umbrellas").

---

## The User

**Dan** — one user, deeply personal. This is not a generic SaaS tool.
- Married, 11 children, lives in Kfar Chabad, Israel
- Front-end developer (React/TypeScript), musician, Chassidus teacher
- Overloaded with obligations, dreams, relationships, and responsibilities across many life domains
- Needs proactive intelligence, not reactive lookup

---

## Core Concept: Umbrellas

Life is organized into **Umbrellas** — areas of Dan's life. Umbrellas are hierarchical (parent → child).

Top-level umbrellas Dan currently uses (configured by him, not hardcoded):
- 👨‍👩‍👧‍👦 **People** — relationships (wife, kids, friends, community)
- 💰 **Money** — income, expenses, investments, projects
- 🧒 **Kids** — each child can be a sub-umbrella
- 🕍 **Spirituality** — Chassidus, davening, learning, mission
- 💪 **Health** — exercise, bloodwork, nutrition, sleep

Each umbrella has: a computed health score (0–100), interview questions, answer history, child umbrellas, tasks, reminders, archive state.

---

## Current State — **Live in Production**

The app is fully deployed and functional. Below is what is actually built.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| State | Zustand 5 |
| Backend | Express 5 + TypeScript |
| ORM | Drizzle ORM + drizzle-kit (auto-migrations on startup) |
| Database | Neon PostgreSQL (serverless) |
| Auth | Passport.js + Google OAuth 2.0 (single allowed email) |
| AI | Anthropic SDK (`claude-opus-4-5` via SSE streaming) |
| WhatsApp | Twilio sandbox (WhatsApp) |
| Scheduler | node-cron (runs every minute on server) |
| Sunset calc | SunCalc (Jerusalem Shabbat window) |
| Session store | connect-pg-simple (sessions in Postgres) |
| Frontend deploy | Vercel |
| Backend deploy | Render |

No React Native, no Electron, no mobile app — this is a **mobile-first PWA** (max-width 430px, runs in browser on phone).

---

## Architecture

### Principle: Single user, no tenancy

There are no `userId` columns in the schema. The app assumes one authenticated user (Dan). Auth is Google OAuth with a hardcoded email allowlist (`ALLOWED_GOOGLE_EMAIL`).

### Data Model (actual schema)

```
umbrellas
  id (uuid), name, icon, parent_id → umbrellas (self-ref, cascade),
  health_score (int, legacy — now computed from answers),
  notes (text[]), position, archived_at, created_at, updated_at

tasks
  id, umbrella_id → umbrellas (cascade), title,
  status (todo|in-progress|done), priority (low|medium|high),
  due_at, position, created_at, updated_at

reminders
  id, umbrella_id → umbrellas (cascade), message, trigger_at,
  is_recurring, created_at

health_history
  id, umbrella_id → umbrellas (cascade), score (int), recorded_at

umbrella_questions
  id, umbrella_id → umbrellas (cascade), text,
  cadence (daily|weekly|monthly|annual),
  day_of_week (0-6), day_of_month (1-31), month_of_year (1-12),
  answer_type (text|scale|boolean|boolean_partial|multi_select),
  scale_min, scale_max, options (jsonb), position, enabled, created_at, updated_at

question_answers
  id, question_id → umbrella_questions (cascade),
  interview_date (date), answer_text, answer_scale (int),
  answer_boolean (yes|no|partial), answer_options (text[]),
  answer_normalized (0.0–1.0), comment (text), created_at
  — UPSERTED per (question_id, interview_date)

interview_session
  id, date (date, unique), started_at, completed_at, current_index

resolutions
  id (uuid), umbrella_id → umbrellas (cascade),
  question_id → umbrella_questions (cascade),
  title (text), start_date (date), end_date (date),
  success_threshold (int, nullable — min scale value for success; null for boolean),
  status (text: 'active'|'completed'|'abandoned'), final_score (int, nullable),
  created_at, updated_at
  — auto-completed by scheduler at 00:01 when end_date < today

chat_messages
  id, role (user|assistant), content, created_at

user_settings          ← singleton row
  id, checkin_time (HH:MM, default 21:00), phone_number,
  timezone (default Asia/Jerusalem), shabbat_mode (bool),
  saturday_checkin_time, last_sandbox_join_at, sandbox_status,
  last_delivery_failure_at, last_60h_reminder_at, created_at, updated_at

whatsapp_session       ← one row per calendar date
  id, date (date, unique),
  state (pending|snoozed|completed|final_sent),
  snooze_count, last_message_at, next_send_at

user_sessions          ← managed by connect-pg-simple
```

**Key schema facts:**
- Health score is **computed**, not stored: `AVG(answer_normalized) * 100` over last 14 days from `question_answers`.
- `health_history` and `umbrellas.health_score` are legacy fields — analytics route computes the real score.
- Deleting an umbrella cascades to all children, tasks, reminders, questions, and answers.
- Interview answers are upserted: re-answering the same question on the same day overwrites, not appends.

---

## Server — Routes & Modules

### Auth (`/auth`)
- `GET /google` — Redirect to Google OAuth
- `GET /google/callback` — Validate email, save session, redirect to frontend
- `GET /me` — Returns `{ authenticated: true, user: {...} }` or `{ authenticated: false }`
- `POST /logout` — Destroy session

### Umbrellas (`/api/umbrellas`)
- `GET /` — Flat list of non-archived umbrellas; `?include=archived` includes archived ones
- `POST /` — Create umbrella (name, icon, parentId)
- `PATCH /:id` — Update name/icon/position/archivedAt
- `DELETE /:id` — Hard delete (all descendants + data cascade)

### Tasks (`/api/tasks`)
- `GET /` — All tasks; `?umbrella=:id` to filter
- `POST /` — Create task
- `PATCH /:id` — Update status / priority / dueAt / position
- `DELETE /:id` — Hard delete

### Interview (`/api/interview`)
- `GET /today` — Compose today's questions by cadence (respects Jerusalem date) + load/create session. Returns `{ questions: ApiComposedQuestion[], session: ApiInterviewSession }`.
- `POST /answer` — Submit one answer; normalizes to 0.0–1.0; upserts into `question_answers`. Uses effective interview date (see below).
- `POST /complete` — Set `completed_at` on today's session; also syncs today's `whatsapp_session` state to `'completed'` (keeps trackers in sync). Uses effective interview date.
- `GET /history` — `?days=30`; past sessions + answers

**Effective interview date (grace window):** All three handlers resolve the interview date via `getEffectiveInterviewDate()`. Before 06:00 Jerusalem, if the most recent `whatsapp_session` with state not in `('completed','final_sent')` is from yesterday, the interview binds to yesterday's date. This handles the common case of Dan completing a check-in after midnight — his answers land on the correct previous day. After 06:00, the effective date is always today.

### Questions (`/api/umbrellas/:id/questions`, `/api/questions`)
- `GET /:umbrellaId/questions` — List questions for an umbrella
- `POST /:umbrellaId/questions` — Create question
- `PATCH /questions/:id` — Update question (text, cadence, answer type, etc.)
- `DELETE /questions/:id` — Delete question + cascade answers

### Analytics (`/api/analytics`)
- `GET /umbrellas/health` — `?days=14`; bulk `{ umbrellaId: score | null }` map for all umbrellas
- `GET /umbrellas/:id/trend` — `?days=42`; `[{ date, score }]` daily averages
- `GET /questions/:id/trend` — `?days=90`; `[{ date, value, answerText, answerScale, answerBoolean }]`

### Chat (`/api/chat`)
- `GET /history` — `?limit=50`; recent messages from `chat_messages`
- `POST /history` — Append one message (used internally)
- `POST /` — Stream Claude response via SSE; system prompt includes full umbrella context (names, scores, recent answers)

### Settings (`/api/settings`)
- `GET /` — Returns current user settings
- `PATCH /` — Update any field; resets today's WhatsApp session state when `checkinTime` changes

### WhatsApp / Sandbox (`/api/sandbox`, `/api/whatsapp`, `/webhook`)
- `GET /sandbox/status` — `{ sandboxStatus, lastSandboxJoinAt, lastDeliveryFailureAt }`
- `POST /sandbox/joined` — Mark re-joined → sets status to `active`
- `POST /whatsapp/reset-today` — Force-reset today's WhatsApp session to `pending`
- `POST /webhook/sms` — Inbound Twilio message handler (Hebrew "בוצע" = done, else = snooze). **Requires valid Twilio signature** (`X-Twilio-Signature`); returns 403 if missing/invalid.
- `POST /webhook/sms-status` — Delivery failure callback; sets `sandbox_status` to `expired`. Signature-verified.
- `POST /webhook/whatsapp` — Backward-compat alias for `/webhook/sms`. Signature-verified.
- `POST /webhook/whatsapp-status` — Backward-compat alias for `/webhook/sms-status`. Signature-verified.

**Webhook security:** All four routes run `verifyTwilioSignature` middleware first. It reads `TWILIO_AUTH_TOKEN` + `PUBLIC_URL` env vars and calls `twilio.validateRequest()`. Skips (with `console.warn`) if `TWILIO_AUTH_TOKEN` is not set, so local dev is unblocked.

### Health History (`/api/health-history`)
- `GET /` — `?umbrella=:id&days=30`
- `POST /` — Record a manual health snapshot

### Resolutions (`/api/umbrellas/:id/resolutions`, `/api/resolutions`)
- `GET /umbrellas/:id/resolutions` — All resolutions for an umbrella; active ones include live computed progress
- `POST /resolutions` — Create resolution; body: `umbrellaId`, `questionId` OR `newQuestion` object, `title`, `startDate`, `endDate`, `successThreshold` (required for scale, forbidden otherwise)
- `PATCH /resolutions/:id` — Update `title`, `endDate`, or `status: 'abandoned'` (which also freezes `finalScore`)
- `GET /resolutions/:id/progress` — Live progress for a single resolution

---

## Server — Lib Modules

### `lib/analytics.ts`
Computes health scores and trends from `question_answers`:
- `computeUmbrellaHealthScore(umbrellaId, days=14)` → 0–100 or null
- `getAllUmbrellaHealthScores(days=14)` → `{ [umbrellaId]: score | null }`
- `getUmbrellaDailyTrend(umbrellaId, days=42)` → `[{ date, score }]`
- `getQuestionDailyTrend(questionId, days=90)` → full answer detail per day

### `lib/interview-composer.ts`
Filters enabled questions by calendar cadence against today's Jerusalem date:
- `daily` → always included
- `weekly` → included when `day_of_week` matches today's weekday (0=Sunday)
- `monthly` → included when `day_of_month` matches today's date
- `annual` → included when both `day_of_month` and `month_of_year` match

Returns questions with umbrella name and icon attached.

### `lib/scheduler.ts`
Cron runs every minute. Four tick functions:
- `tickCheckin()` — Sends WhatsApp check-in at configured time; skips during Shabbat window (Friday sunset−1h → Saturday sunset+1h, via SunCalc); uses `saturday_checkin_time` if set
- `tickMorning()` — Sends 09:00 reminder if yesterday's check-in wasn't completed. Guards (in order): (1) `interview_session.completed_at` set → skip; (2) all of yesterday's due questions have answers in `question_answers` → skip (belt-and-suspenders for failed `POST /complete`); (3) `whatsapp_session.state = 'completed'` → skip; otherwise sends MORNING_AFTER_SKIP.
- `tickSandboxReminder()` — Sends once-per-day reminder ~60h before sandbox expiry
- `tickResolutions()` — At 00:01 Jerusalem, auto-completes active resolutions whose `end_date` has passed; computes final score and sets `status='completed'`

### `lib/resolutions.ts`
Progress computation for resolutions:
- `computeResolutionProgress(resolution, questionAnswerType)` → `{ successfulDays, elapsedDays, totalDays, percentage, currentStreak, longestStreak, daysRemaining }`
- A day is successful if: boolean/boolean_partial → `answer_boolean = 'yes'`; scale → `answer_scale >= success_threshold`
- `currentStreak` counts backwards from the last answered date

### `lib/whatsapp.ts`
Thin wrapper: `sendWhatsApp(to, text)` → `twilio.messages.create()`.

### `lib/whatsapp-messages.ts`
Hebrew message templates: check-in prompt, snooze followup, final message, morning skip recovery, thanks, sandbox renewal reminder.

### `lib/auth.ts`
Passport Google OAuth strategy. Email validated against `ALLOWED_GOOGLE_EMAIL`. Session explicitly saved before redirect to prevent race condition on Render.

---

## Client — Screens

### HomeScreen
Dashboard. Shows: Life Wellness Score ring (computed from umbrella scores), umbrella grid (2-col, each with score + sparkline), AI nudges empty state (real nudges not yet built), "Add umbrella" button, archived count link, sandbox expiry banner.

### UmbrellaDetail
Full umbrella view. Shows: 6-week trend sparkline (from analytics), sub-areas list (real child umbrellas only — no mock data), questions editor (add/edit/delete with cadence + answer type), per-question trend charts, **resolutions section** (active cards with progress bars + streaks, creation form, past resolutions collapsible, detail/abandon modal). Header has a **⋮ kebab button** (nav row, left side in RTL) that opens a bottom sheet with: שינוי שם, שינוי אייקון, העברה תחת מטרייה אחרת, ארכוב, מחיקה (red). Rename/icon actions open the existing inline-edit form. Delete confirmation is a bottom sheet modal. No action buttons at the bottom of the screen.

### InterviewScreen
Daily interview. Loads real questions from `/api/interview/today`. Progress bar, umbrella badge, multiple answer types (text, scale, boolean, boolean_partial). Resumes from `currentIndex` if interrupted. Completion screen in Hebrew. If `POST /complete` fails after all answers are saved, shows a Hebrew retry message ("לא הצלחנו לשמור את הסיום — נסה שוב") rather than silently resetting.

### ChatScreen
AI chat. Loads history from DB; streams live responses via SSE. Empty state when no history. Claude system prompt includes current umbrella scores and recent answers.

### ProfileScreen
Settings overview. Shows: avatar, display name, umbrella health rings. Notification toggles (morning brief and AI nudges are UI-only, not yet wired). Shabbat mode persisted to DB. Personality/language chips are UI-only. Logout button.

### SettingsScreen
WhatsApp configuration. Time picker, phone number input, Shabbat mode toggle, Saturday override time picker. All persisted to `user_settings`. Shows sandbox status banner.

### ArchivedScreen
Lists archived umbrellas with archive date. Restore button per item (sets `archived_at` to null).

### BottomNav
Five tabs: Home, Umbrellas (→ HomeScreen), Chat (center accent), Check-in (→ InterviewScreen), Profile.

---

## Client — Key Patterns

### State (Zustand store `useStore`)
Holds the umbrella tree (flat list + `findUmbrella` helper). Loads umbrella list + bulk analytics health scores on auth. Computed fields (`computedHealthScore`, `computedTrend`) attached to each umbrella after fetch.

### API layer (`lib/api.ts`)
All server calls go through typed functions in `api.ts`. Base URL from `VITE_API_BASE_URL` env var (defaults to `http://localhost:3001`). All requests use `credentials: 'include'` for session cookies.

### Chat streaming (`hooks/useChat.ts`)
Uses `fetch` with SSE via `ReadableStream`. Accumulates streamed tokens into the last message. `isStreaming` flag controls UI state.

### Theme (`lib/theme.ts`)
Central token object `T` with color palette (sage, amber, blue, charcoal, red, purple + light variants). `umbrellaColor(name)` deterministically picks a color from the palette based on umbrella name.

---

## Deployment

### Frontend — Vercel
- Root directory: `client/`
- Build: `tsc -b && vite build`
- Output: `dist/`
- Env var: `VITE_API_BASE_URL=https://mynefesh-api.onrender.com`

### Backend — Render
- Root directory: `server/`
- Build: `npm install && npm run build`
- Start: `npm start`
- Migrations auto-run on startup via Drizzle

### Database — Neon
- Serverless PostgreSQL
- Connection via `DATABASE_URL` env var
- Sessions stored in `user_sessions` table (connect-pg-simple)

### Required environment variables (server)
```
DATABASE_URL               # Neon connection string
SESSION_SECRET             # Random secret for session signing
GOOGLE_CLIENT_ID           # Google OAuth client ID
GOOGLE_CLIENT_SECRET       # Google OAuth client secret
GOOGLE_CALLBACK_URL        # https://mynefesh-api.onrender.com/auth/google/callback
ALLOWED_GOOGLE_EMAIL       # Dan's Gmail address
FRONTEND_URL               # https://mynefesh.vercel.app (for OAuth redirect)
ALLOWED_ORIGIN             # https://mynefesh.vercel.app (CORS)
ANTHROPIC_API_KEY          # Claude API key
TWILIO_ACCOUNT_SID         # Twilio account SID
TWILIO_AUTH_TOKEN          # Twilio auth token
TWILIO_WHATSAPP_FROM       # whatsapp:+14155238886 (sandbox number)
USER_WHATSAPP_NUMBER       # whatsapp:+972XXXXXXXXX (Dan's number)
PUBLIC_URL                 # https://mynefesh-api.onrender.com (for webhooks)
```

---

## What's Built and Live

- **Google OAuth auth** — Login, session, single-user email validation
- **Umbrella CRUD** — Create, rename, archive, delete (cascade), restore archived
- **Child umbrellas** — Full hierarchy support; sub-areas shown in UmbrellaDetail
- **Interview system** — Cadence-based questions, all answer types, session tracking, Jerusalem-aware date
- **Answer normalization** — All answer types map to 0.0–1.0 for analytics
- **Computed health scores** — AVG of recent normalized answers (14-day window)
- **Analytics trends** — 42-day per-umbrella, 90-day per-question
- **AI Chat** — Streaming Claude responses with live umbrella context in system prompt
- **WhatsApp scheduler** — Cron-based, Hebrew messages, snooze/done flow via inbound webhook
- **Shabbat mode** — Real Jerusalem sunset window (SunCalc), skips Fri eve → Sat eve
- **Saturday override** — Optional separate check-in time on Saturdays
- **Sandbox management** — Expiry detection via delivery failure webhook, 60h reminder, renewal flow
- **Settings screen** — All WhatsApp settings persisted to DB
- **Tasks** — Create, status toggle, priority, delete per umbrella
- **Archived umbrellas** — Archive, browse, restore flow
- **Full Hebrew + RTL UI** — All screens localized: login, nav tabs, HomeScreen, ChatScreen, ProfileScreen, UmbrellaDetail, ArchivedScreen; `index.html` has `lang="he" dir="rtl"`
- **Resolutions** — Time-bound commitments per umbrella with progress tracking, streak computation, auto-complete via scheduler, abandon flow

---

## What's Partially Done / In-Flight

- **AI Nudges** — Home screen has the UI slot (empty state card) but no generation logic. Nudges need to be generated by Claude based on answer patterns, overdue interviews, relationship gaps, etc.
- **Personality / Language settings** — ProfileScreen has UI chips (`warm | direct | spiritual`, `EN | HE`) but these are not persisted or passed to Claude's system prompt yet.
- **Morning brief toggle** — ProfileScreen toggle exists but not wired to scheduler behavior.
- **AI nudges toggle** — Same: UI-only, not wired.

---

## What's Planned Next

- **Real AI nudges** — Claude analyzes answer history + umbrella gaps → generates 2-3 contextual nudges on HomeScreen
- **Claude tool use in chat** — Allow Claude to create tasks, update reminders, schedule interview questions via function calling during chat
- **Resolutions / goals tracking** — Long-horizon targets per umbrella, progress over time
- **Push notifications** — Browser push or WhatsApp for time-sensitive nudges (currently only scheduled check-in)
- **Voice input** — Mic button in chat (currently shows icon but no recording logic)
- **Per-umbrella AI summary** — Claude-generated health narrative in UmbrellaDetail
- **Data export** — Export umbrella history, answers, trends as CSV or PDF

---

## Known Caveats & Gotchas

1. **Twilio WhatsApp sandbox expires every 72 hours.** Dan must re-join by texting the sandbox join phrase. The system detects expiry via Twilio delivery failure webhooks and shows a banner + sends a 60h reminder message. After re-joining, tap "I've re-joined ✓" in Settings.

2. **Session storage is Postgres-backed.** `connect-pg-simple` + `user_sessions` table. If `DATABASE_URL` is absent in dev, an in-memory store is used (sessions lost on restart).

3. **Health scores are null until first interview is completed.** An umbrella with no answered questions shows `—` in the UI, not 0. This is correct behavior.

4. **Cascade deletes are permanent.** Deleting an umbrella removes all questions, answers, tasks, reminders, and children. Archive instead of delete if in doubt.

5. **Jerusalem timezone throughout.** The scheduler, interview composer, and Shabbat logic all use `Asia/Jerusalem`. The `interview_date` column is a calendar date in that zone.

6. **Render cold starts.** Render's free tier spins down after inactivity. First request after sleep takes ~30s. Scheduler won't fire during sleep.

7. **No `userId` in schema.** The entire database is single-user. Do not add multi-tenancy without a full schema migration plan.

8. **`health_score` column on `umbrellas` table is legacy.** The UI uses `computedHealthScore` from the analytics route, not `umbrella.health_score`. Don't write to `health_score` for anything new.

---

## Working Style — Dan's Rules

- Dan is a React/TypeScript developer — use patterns he already knows
- Speed over perfection — ship working things, iterate
- Ask before making architectural decisions
- Keep components small and focused
- No unnecessary libraries — justify every dependency
- Comments in English
- When stuck, explain the problem clearly and offer 2–3 options with tradeoffs
- No hardcoded mock/prototype data in the UI — if data isn't real, show an empty state

---

## Notes for Claude

- Always refer to the user as **Dan**
- This is a deeply personal product — treat it with care
- When adding features, ask: "does this make Dan's life simpler or more complex?"
- The north star: Dan opens MyNefesh and immediately feels clarity and calm
- Never add hardcoded example data (names, placeholder content) to UI components
- `CheckinScreen` was deleted — `App.tsx` routes `checkin` → `InterviewScreen`. Don't create a new one.
- Before touching the WhatsApp scheduler, test locally with `NODE_ENV=development` and mock Twilio calls

---

## Standing Rule — CLAUDE.md Maintenance

**This rule is mandatory and non-negotiable.**

After every Cowork session, before the task is considered done, Claude MUST:

1. Update the **Current State** section to reflect what's actually live in production right now.
2. Update the **Active Sprint** section to reflect what's in flight and what's next.
3. Update the **Stack** section if any dependency, hosting, or service has changed.
4. Update the **Data Model** section if any schema, migration, table, column, or relationship has changed.

Then commit the updated CLAUDE.md with the message:

```
docs: update CLAUDE.md
```

A session is not done until this commit lands. No exceptions.
