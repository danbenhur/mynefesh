import twilio from 'twilio'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'

const DAILY_SMS_LIMIT = parseInt(process.env.DAILY_SMS_LIMIT ?? '50', 10)

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

async function getTodaySmsCount(): Promise<number> {
  try {
    const db = getDb()
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt FROM api_usage WHERE kind = 'sms' AND day_utc = CURRENT_DATE`
    )
    return parseInt(String(result.rows[0]?.cnt ?? '0'), 10)
  } catch {
    return 0 // fail open — don't suppress sends when DB is unavailable
  }
}

async function recordSmsUsage(): Promise<void> {
  try {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    await db.execute(
      sql`INSERT INTO api_usage (kind, occurred_at, day_utc) VALUES ('sms', NOW(), ${today}::date)`
    )
  } catch (err) {
    console.error('[messaging] Failed to record SMS usage:', err)
  }
}

export async function sendSMS(text: string): Promise<string | null> {
  const todayCount = await getTodaySmsCount()
  if (todayCount >= DAILY_SMS_LIMIT) {
    console.warn(`[SMS CAP] Daily SMS limit reached (${todayCount}/${DAILY_SMS_LIMIT}), suppressing send`)
    return null
  }

  const client = getClient()
  if (!client) {
    console.warn('[messaging] Twilio env vars not set — skipping send')
    return null
  }

  const from = process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM
  const to = process.env.USER_SMS_NUMBER ?? process.env.USER_WHATSAPP_NUMBER
  if (!from || !to) {
    console.warn('[messaging] No from/to configured (set TWILIO_SMS_FROM + USER_SMS_NUMBER) — skipping send')
    return null
  }

  try {
    const statusCallback = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/webhook/whatsapp-status`
      : undefined
    const msg = await client.messages.create({ from, to, body: text, statusCallback })
    console.log(`[messaging] Sent message SID=${msg.sid}`)
    await recordSmsUsage()
    return msg.sid
  } catch (err) {
    console.error('[messaging] Send failed:', err)
    return null
  }
}
