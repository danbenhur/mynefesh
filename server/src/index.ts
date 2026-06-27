import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { sql } from 'drizzle-orm'
import { getDb } from './db/index.js'
import { startScheduler } from './lib/scheduler.js'
import app from './app.js'

const PORT = process.env.PORT ?? 3001

console.log('[startup-diag] env vars:',
  'TWILIO_ACCOUNT_SID=' + (!!process.env.TWILIO_ACCOUNT_SID),
  'TWILIO_AUTH_TOKEN=' + (!!process.env.TWILIO_AUTH_TOKEN),
  'TWILIO_SMS_FROM=' + (!!process.env.TWILIO_SMS_FROM),
  'PUBLIC_URL=' + (process.env.PUBLIC_URL ?? 'MISSING'),
  'DAILY_SMS_LIMIT=' + (process.env.DAILY_SMS_LIMIT ?? 'default'),
)

async function verifySchemaMatchesCode(): Promise<void> {
  const db = getDb()
  try {
    await db.execute(sql`SELECT user_id FROM user_settings LIMIT 1`)
    console.log('[startup-diag] schema probe: user_settings.user_id OK')
  } catch (err) {
    console.error('[startup-diag] SCHEMA MISMATCH — user_settings.user_id missing:', (err as Error).message)
    console.error('[startup-diag] Migration 0017/0018 may not have applied. Service will degrade until corrected.')
  }
}

// Run migrations before accepting traffic. Skipped if DATABASE_URL is absent (local dev without DB).
if (process.env.DATABASE_URL) {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')
  try {
    console.log('[startup-diag] running migrate()')
    await migrate(getDb(), { migrationsFolder })
    console.log('[startup-diag] migrations completed successfully')
  } catch (err) {
    console.error('[startup-diag] Migration failed — exiting:', err)
    process.exit(1)
  }

  await verifySchemaMatchesCode()
  startScheduler()
  console.log('[startup-diag] scheduler started')
}

app.listen(PORT, () => {
  console.log(`[startup-diag] MyNefesh server listening on port ${PORT}`)
})
