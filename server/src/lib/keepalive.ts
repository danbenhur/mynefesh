import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'

// The external keep-alive (cron-job.org) hits GET /api/health every few minutes.
// Render's free tier spins the process down on HTTP inactivity regardless of
// node-cron, so if that ping dies the scheduler silently stops firing — the
// exact failure behind the July 2026 SMS outage (docs/specs/001-sms-outage.md).

const PING_WRITE_INTERVAL_MS = 60_000
const STALE_PING_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

let lastPingWriteAt = 0

// Called from GET /api/health. Throttled to one DB write per minute so the
// ping cadence doesn't multiply Neon traffic. Fire-and-forget: never fails the
// health response.
export function recordHealthPing(): void {
  if (!process.env.DATABASE_URL) return
  if (Date.now() - lastPingWriteAt < PING_WRITE_INTERVAL_MS) return
  lastPingWriteAt = Date.now()

  const db = getDb()
  db.execute(
    sql`INSERT INTO system_health (id, last_ping_at) VALUES (1, NOW())
        ON CONFLICT (id) DO UPDATE SET last_ping_at = NOW()`
  ).catch((err: unknown) => {
    console.error('[keepalive] failed to record health ping:', (err as Error).message)
  })
}

// Called once at startup, after migrations. If the last recorded ping is older
// than an hour (or missing), the keep-alive job is dead and check-ins WILL be
// missed — shout about it so the very first log line after a wake-up says why.
export async function warnIfKeepaliveStale(): Promise<void> {
  try {
    const db = getDb()
    const result = await db.execute(sql`SELECT last_ping_at FROM system_health WHERE id = 1`)
    const lastPingAt = result.rows[0]?.last_ping_at as string | Date | undefined

    if (!lastPingAt) {
      console.error(
        '[KEEPALIVE WARNING] No health ping has ever been recorded. ' +
        'Verify the cron-job.org job is pinging GET /api/health — without it, ' +
        'Render spins down and NO scheduled SMS check-ins are sent.'
      )
      return
    }

    const ageMs = Date.now() - new Date(lastPingAt).getTime()
    if (ageMs > STALE_PING_THRESHOLD_MS) {
      const ageHours = (ageMs / 3_600_000).toFixed(1)
      console.error(
        `[KEEPALIVE WARNING] Last health ping was ${ageHours}h ago (${new Date(lastPingAt).toISOString()}). ` +
        'The keep-alive job is likely dead or deactivated — re-enable the cron-job.org ping to GET /api/health, ' +
        'or the server will sleep through scheduled SMS check-ins.'
      )
    } else {
      console.log(`[keepalive] last health ping ${Math.round(ageMs / 60_000)}m ago — keep-alive OK`)
    }
  } catch (err) {
    console.error('[keepalive] startup staleness check failed:', (err as Error).message)
  }
}
