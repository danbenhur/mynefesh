import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getPgPool } from '../db/index.js'

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

// Marks all journal entries as applied for databases that already have a schema but
// no migration-tracking table (e.g. pre-seeder deployments or manual DB resets).
// Drizzle's migrate() then only runs genuinely new migrations not yet in the journal.
export async function seedMigrationsIfNeeded(migrationsFolder: string): Promise<void> {
  const pool = getPgPool()
  if (!pool) return

  // Only seed when the DB already has a schema (not a fresh database).
  const tableCheck = await pool.query<{ count: number }>(`
    SELECT COUNT(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'umbrellas'
  `)
  if (tableCheck.rows[0].count === 0) return  // Fresh DB — let migrate() handle everything.

  // Check whether __drizzle_migrations exists and has entries.
  const hasTable = await pool.query<{ count: number }>(`
    SELECT COUNT(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
  `)

  if (hasTable.rows[0].count > 0) {
    const hasRows = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM __drizzle_migrations')
    if (hasRows.rows[0].count > 0) return  // Already seeded.
  }

  const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
  )

  console.log(`[seeder] Existing schema detected with no migration history — seeding baseline (0–${journal.entries.length - 1}).`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id   SERIAL PRIMARY KEY,
      hash text   NOT NULL,
      created_at bigint
    )
  `)

  for (const entry of journal.entries) {
    const sql = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), 'utf8')
    // Drizzle hashes the raw file content with SHA-256 (same algorithm as migrate()).
    const hash = createHash('sha256').update(sql).digest('hex')
    await pool.query(
      `INSERT INTO __drizzle_migrations (hash, created_at)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = $1)`,
      [hash, entry.when]
    )
    console.log(`[seeder] Marked ${entry.tag} as applied.`)
  }

  console.log('[seeder] Done — migrate() will now only run future migrations.')
}
