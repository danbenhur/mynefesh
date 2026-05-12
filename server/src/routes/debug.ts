import { Router } from 'express'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
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

// Returns column names + data types for a table, drizzle migration state, and all schemas
router.get('/schema-public', async (req, res) => {
  const pool = getPgPool()
  if (!pool) { res.status(503).json({ error: 'No DATABASE_URL' }); return }
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
      // Check both drizzle schema and public schema for migration tracking table
      const drizzleSchemaMigs = await client.query(
        `SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`
      ).catch(() => ({ rows: null }))
      const publicSchemaMigs = await client.query(
        `SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at`
      ).catch(() => ({ rows: null }))

      const allTables = await client.query(
        `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_schema NOT IN ('pg_catalog','information_schema')
         ORDER BY table_schema, table_name`
      )
      res.json({
        table,
        columns: cols.rows,
        drizzle_schema_migrations: drizzleSchemaMigs.rows,  // null = table missing
        public_schema_migrations: publicSchemaMigs.rows,     // null = table missing
        all_tables: allTables.rows,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Runs raw SQL — POST body: { sql: string }
// Only accepts ALTER TABLE / CREATE TABLE / INSERT statements as a safety guard
router.post('/run-sql-public', async (req, res) => {
  const pool = getPgPool()
  if (!pool) { res.status(503).json({ error: 'No DATABASE_URL' }); return }
  const rawSql: string = req.body?.sql ?? ''
  const normalized = rawSql.trim().toUpperCase()
  if (!normalized.startsWith('ALTER TABLE') && !normalized.startsWith('CREATE TABLE')
      && !normalized.startsWith('INSERT') && !normalized.startsWith('CREATE SCHEMA')) {
    res.status(400).json({ error: 'Only ALTER TABLE / CREATE TABLE / CREATE SCHEMA / INSERT allowed' })
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

// One-time migration repair: applies missing 0004/0005 SQL and records all migrations in
// drizzle.__drizzle_migrations so future deploys don't crash trying to re-run 0000-0003.
// Safe to call multiple times — all operations are idempotent.
router.post('/migrate-public', async (_req, res) => {
  const pool = getPgPool()
  if (!pool) { res.status(503).json({ error: 'No DATABASE_URL' }); return }

  const client = await pool.connect()
  const results: string[] = []
  try {
    // Ensure drizzle schema and migration tracking table exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`)
    results.push('drizzle schema ready')

    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL NOT NULL,
        hash text NOT NULL,
        created_at bigint
      )
    `)
    results.push('drizzle.__drizzle_migrations ready')

    // Collect hashes already recorded
    const existing = await client.query<{ hash: string }>(
      `SELECT hash FROM drizzle.__drizzle_migrations`
    )
    const appliedHashes = new Set(existing.rows.map(r => r.hash))
    results.push(`Already recorded: ${appliedHashes.size} migration(s)`)

    // Locate the drizzle/ migrations folder relative to this built file
    const thisDir = dirname(fileURLToPath(import.meta.url))
    const migrationsFolder = join(thisDir, '..', '..', 'drizzle')
    results.push(`Migrations folder: ${migrationsFolder}`)

    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
    ) as { entries: Array<{ idx: number; tag: string; when: number }> }

    // Idempotent SQL for migrations that can't just be re-run verbatim
    const idempotentStatements: Record<string, string[]> = {
      '0004_sandbox_expiry': [
        `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_sandbox_join_at" timestamp with time zone`,
        `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sandbox_status" text NOT NULL DEFAULT 'unknown'`,
        `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_delivery_failure_at" timestamp with time zone`,
        `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "last_60h_reminder_at" timestamp with time zone`,
      ],
      '0005_interview_session': [
        `CREATE TABLE IF NOT EXISTS "interview_session" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "date" date NOT NULL,
          "started_at" timestamp with time zone,
          "completed_at" timestamp with time zone,
          "current_index" integer DEFAULT 0 NOT NULL,
          CONSTRAINT "interview_session_date_unique" UNIQUE("date")
        )`,
      ],
    }

    for (const entry of journal.entries) {
      const content = readFileSync(join(migrationsFolder, entry.tag + '.sql'), 'utf8')
      const hash = createHash('sha256').update(content).digest('hex')

      if (appliedHashes.has(hash)) {
        results.push(`Skip ${entry.tag} (${hash.slice(0, 8)}…): already recorded`)
        continue
      }

      // Run idempotent statements if defined; for 0000-0003 there are none (tables exist already)
      const stmts = idempotentStatements[entry.tag] ?? []
      for (const stmt of stmts) {
        await client.query(stmt)
        results.push(`SQL: ${stmt.trim().slice(0, 70)}…`)
      }

      // Record the migration
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when]
      )
      appliedHashes.add(hash)
      results.push(`Recorded ${entry.tag} (${hash.slice(0, 8)}…)`)
    }

    // Verify user_settings now has the 0004 columns
    const verify = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_settings' ORDER BY ordinal_position`
    )
    results.push(`user_settings columns: ${verify.rows.map((r: { column_name: string }) => r.column_name).join(', ')}`)

    res.json({ ok: true, results })
  } catch (err) {
    res.status(500).json({ error: String(err), results })
  } finally {
    client.release()
  }
})

export default router
