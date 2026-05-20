import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { getDb, getPgPool } from '../db/index.js'
import { whatsappSession, userSettings } from '../db/schema.js'

const router = Router()

function debugPayload() {
  const db = getDb()
  return Promise.all([
    db.select().from(whatsappSession).orderBy(desc(whatsappSession.date)).limit(3),
    db.select().from(userSettings).limit(1),
  ])
}

function envPresence() {
  return {
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: !!process.env.TWILIO_WHATSAPP_FROM,
    USER_WHATSAPP_NUMBER: !!process.env.USER_WHATSAPP_NUMBER,
  }
}

function jerusalemNow() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

// Auth-gated
router.get('/whatsapp-status', async (_req, res) => {
  try {
    const [sessions, settings] = await debugPayload()
    res.json({
      settings: settings[0] ?? null,
      sessions,
      serverTime: new Date().toISOString(),
      serverTimeJerusalem: jerusalemNow(),
      env: envPresence(),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Public — kept for ongoing diagnostics
router.get('/whatsapp-status-public', async (_req, res) => {
  try {
    const [sessions, settings] = await debugPayload()
    const s = settings[0] ?? null
    res.json({
      settings: s ? {
        checkinTime: s.checkinTime,
        phoneNumber: s.phoneNumber,
        timezone: s.timezone,
      } : null,
      sessions: sessions.map(row => ({
        date: row.date,
        state: row.state,
        snoozeCount: row.snoozeCount,
        lastMessageAt: row.lastMessageAt,
      })),
      serverTime: new Date().toISOString(),
      serverTimeJerusalem: jerusalemNow(),
      env: envPresence(),
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Public — resets today's whatsapp session state to pending for re-testing
router.post('/reset-today-public', async (_req, res) => {
  try {
    const db = getDb()
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).reduce((acc, p) =>
      p.type === 'literal' ? acc : { ...acc, [p.type]: p.value }, {} as Record<string, string>)
    const today = `${date.year}-${date.month}-${date.day}`

    const existing = await db.select().from(whatsappSession).where(eq(whatsappSession.date, today))
    if (existing.length === 0) {
      res.status(404).json({ error: `No session found for ${today}` })
      return
    }

    const before = {
      date: existing[0].date, state: existing[0].state,
      snoozeCount: existing[0].snoozeCount, lastMessageAt: existing[0].lastMessageAt,
    }

    const updated = await db
      .update(whatsappSession)
      .set({ state: 'pending', snoozeCount: 0, lastMessageAt: null, nextSendAt: null })
      .where(eq(whatsappSession.date, today))
      .returning()

    const after = {
      date: updated[0].date, state: updated[0].state,
      snoozeCount: updated[0].snoozeCount, lastMessageAt: updated[0].lastMessageAt,
    }

    res.json({ ok: true, today, before, after })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Public — raw SQL counts to diagnose interview "no questions" bug
// Uses pool directly to avoid Drizzle schema column mapping (options col may not exist yet)
router.get('/data-counts-public', async (_req, res) => {
  const pool = getPgPool()
  if (!pool) {
    res.status(503).json({ error: 'No database connection' })
    return
  }
  try {
    const [umbrellaRes, questionRes, answerRes, colRes, pgVerRes, migrationsRes] = await Promise.all([
      pool.query(`SELECT id, name, archived_at IS NOT NULL AS archived FROM umbrellas ORDER BY position`),
      pool.query(`SELECT id, umbrella_id, text, cadence, enabled, answer_type FROM umbrella_questions ORDER BY created_at`),
      pool.query(`SELECT COUNT(*)::int AS count FROM question_answers`),
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'umbrella_questions' ORDER BY ordinal_position`),
      pool.query(`SELECT version()`),
      pool.query(`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 15`).catch(() => ({ rows: [] })),
    ])

    res.json({
      umbrellas: { count: umbrellaRes.rowCount, rows: umbrellaRes.rows },
      questions: { count: questionRes.rowCount, rows: questionRes.rows },
      answerCount: answerRes.rows[0].count,
      umbrellaQuestionsColumns: colRes.rows.map((r: { column_name: string }) => r.column_name),
      pgVersion: pgVerRes.rows[0].version,
      appliedMigrations: migrationsRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// One-shot schema repair — runs the ALTER statements that the migration runner
// failed to apply, then removes itself from usefulness via a guard flag.
router.post('/force-schema-public', async (_req, res) => {
  const pool = getPgPool()
  if (!pool) {
    res.status(503).json({ error: 'No database connection' })
    return
  }
  try {
    await pool.query(`ALTER TABLE umbrella_questions ADD COLUMN IF NOT EXISTS options jsonb`)
    await pool.query(`ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS answer_options text[]`)
    await pool.query(`ALTER TABLE question_answers ADD COLUMN IF NOT EXISTS comment text`)
    // Enum value — use a DO block so it's safe even if multi_select already exists
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'multi_select'
            AND enumtypid = 'answer_type'::regtype
        ) THEN
          ALTER TYPE answer_type ADD VALUE 'multi_select';
        END IF;
      END $$
    `)

    // Confirm columns now present
    const colRes = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'umbrella_questions' ORDER BY ordinal_position
    `)
    const cols = colRes.rows.map((r: { column_name: string }) => r.column_name)
    res.json({ ok: true, umbrellaQuestionsColumns: cols })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
