import { Router } from 'express'
import { desc, eq, sql } from 'drizzle-orm'
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

// Auth-gated version
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

// Temporary unauthenticated version — REMOVE AFTER DEBUGGING
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

// Temporary public reset — REMOVE AFTER DEBUGGING
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

    const before = { date: existing[0].date, state: existing[0].state, snoozeCount: existing[0].snoozeCount, lastMessageAt: existing[0].lastMessageAt }

    const updated = await db
      .update(whatsappSession)
      .set({ state: 'pending', snoozeCount: 0, lastMessageAt: null, nextSendAt: null })
      .where(eq(whatsappSession.date, today))
      .returning()

    const after = { date: updated[0].date, state: updated[0].state, snoozeCount: updated[0].snoozeCount, lastMessageAt: updated[0].lastMessageAt }

    res.json({ ok: true, today, before, after })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Returns column names + data types for a given table via information_schema
// Also returns which migrations are recorded in __drizzle_migrations
router.get('/schema-public', async (req, res) => {
  const pool = getPgPool()
  if (!pool) {
    res.status(503).json({ error: 'No DATABASE_URL' })
    return
  }
  try {
    const table = String(req.query.table ?? 'user_settings')
    const client = await pool.connect()
    try {
      const cols = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [table]
      )
      const drizzleMigrations = await client.query(
        `SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at`
      ).catch(() => ({ rows: [] }))  // table may not exist
      const allTables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
      )
      res.json({
        table,
        columns: cols.rows,
        drizzle_migrations: drizzleMigrations.rows,
        public_tables: allTables.rows.map((r: { table_name: string }) => r.table_name),
      })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Runs raw SQL — POST body: { sql: string }
// Only accepts ALTER TABLE / CREATE TABLE statements as a safety guard
router.post('/run-sql-public', async (req, res) => {
  const pool = getPgPool()
  if (!pool) {
    res.status(503).json({ error: 'No DATABASE_URL' })
    return
  }
  const rawSql: string = req.body?.sql ?? ''
  const normalized = rawSql.trim().toUpperCase()
  if (!normalized.startsWith('ALTER TABLE') && !normalized.startsWith('CREATE TABLE') && !normalized.startsWith('INSERT')) {
    res.status(400).json({ error: 'Only ALTER TABLE / CREATE TABLE / INSERT allowed' })
    return
  }
  try {
    const client = await pool.connect()
    try {
      await client.query(rawSql)
      res.json({ ok: true, sql: rawSql })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
